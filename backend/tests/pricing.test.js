// Server-authoritative pricing, Decimal money, order price snapshots,
// expectedTotal checks and payment state. Uses its own test product (so seed
// prices are never touched) and throwaway users; after() removes everything.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { signAccessToken } from "../utils/jwt.js";
import { cancelOrder } from "../services/orderService.js";
import {
    calculateTotals, serializeTotals, roundMoney, unitPriceOf, originalPriceOf, lineTotalOf, toMoney,
} from "../services/pricingService.js";
import { startServer } from "./helpers.js";

const D = (value) => new Prisma.Decimal(value);
const RUN = crypto.randomBytes(4).toString("hex");
const userIds = [];
let server, product, fallback, override, whole;

// ---------------------------------------------------------------- unit tests

test("unit: variant price overrides product price; otherwise product price", () => {
    assert.ok(unitPriceOf({ price: D("24.50") }, { price: D("19.99") }).equals(D("24.50")));
    assert.ok(unitPriceOf({ price: null }, { price: D("19.99") }).equals(D("19.99")));
    assert.ok(unitPriceOf({ price: D("10") }, { price: D("19.99") }).equals(D("10.00")));
    assert.equal(originalPriceOf({ originalPrice: null }, { originalPrice: null }), null);
    assert.ok(originalPriceOf({ originalPrice: null }, { originalPrice: D("30") }).equals(D("30")));
});

test("unit: Decimal arithmetic has no float error", () => {
    // In JS numbers: 0.1 * 3 = 0.30000000000000004, 19.99 * 3 = 59.97000000000001
    assert.equal(lineTotalOf(D("0.10"), 3).toFixed(2), "0.30");
    assert.equal(lineTotalOf(D("19.99"), 3).toFixed(2), "59.97");
    assert.equal(lineTotalOf(D("33.33"), 3).toFixed(2), "99.99");

    const many = Array.from({ length: 10 }, () => ({ unitPrice: D("0.10"), quantity: 1 }));
    assert.equal(calculateTotals(many).total.toFixed(2), "1.00");
});

test("unit: rounding is explicit half-up to cents", () => {
    assert.equal(roundMoney("1.005").toFixed(2), "1.01");
    assert.equal(roundMoney("1.004").toFixed(2), "1.00");
    assert.equal(roundMoney("2.675").toFixed(2), "2.68"); // 2.675 as a JS float rounds down
    assert.equal(toMoney(D("10")), 10);
});

test("unit: totals are Decimals and satisfy subtotal + shipping + tax - discount = total", () => {
    const totals = calculateTotals([
        { unitPrice: D("19.99"), quantity: 3 },
        { unitPrice: D("24.50"), quantity: 2 },
        { unitPrice: D("10.00"), quantity: 1 },
    ]);

    for (const value of Object.values(totals)) assert.ok(value instanceof Prisma.Decimal);
    assert.equal(totals.subtotal.toFixed(2), "118.97");
    assert.ok(totals.subtotal.add(totals.shipping).add(totals.tax).sub(totals.discount).equals(totals.total));
    assert.deepEqual(serializeTotals(totals), { subtotal: 118.97, shipping: 0, tax: 0, discount: 0, total: 118.97 });
    assert.deepEqual(serializeTotals(calculateTotals([])), { subtotal: 0, shipping: 0, tax: 0, discount: 0, total: 0 });
});

// --------------------------------------------------------- integration tests

async function makeUser(label) {
    const user = await prisma.user.create({
        data: { email: `phase8-${label}-${RUN}@example.test`, passwordHash: "not-a-login", firstName: "Test", lastName: label, role: "CUSTOMER" },
    });
    userIds.push(user.id);
    return { id: user.id, headers: { Authorization: `Bearer ${signAccessToken(user)}` } };
}

async function call(method, path, user, body) {
    const res = await fetch(`${server.url}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(user?.headers ?? {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
}

async function shopper(label, lines) {
    const user = await makeUser(label);
    const address = await call("POST", "/addresses", user, {
        firstName: "Test", lastName: "Buyer", phone: "5551234567", address: "1 Phase Eight Street",
        city: "Austin", state: "TX", zipCode: "73301", country: "United States",
    });
    assert.equal(address.status, 201);
    for (const [variant, quantity] of lines) {
        assert.equal((await call("POST", "/cart/items", user, { variantId: variant.id, quantity })).status, 201);
    }
    return { ...user, addressId: address.body.data.id };
}

const stockOf = async (id) => (await prisma.productVariant.findUnique({ where: { id } })).stock;

before(async () => {
    server = await startServer();
    const category = await prisma.category.findFirst({ where: { parentId: { not: null }, isActive: true } });
    product = await prisma.product.create({
        data: {
            categoryId: category.id, name: `Phase 8 Test Tee ${RUN}`, slug: `phase8-test-${RUN}`,
            description: "Pricing test fixture", brand: "Nike", price: D("19.99"), isActive: true,
            variants: {
                create: [
                    { sku: `P8-${RUN}-FALLBACK`, size: "S", color: "Black", price: null, stock: 50 },
                    { sku: `P8-${RUN}-OVERRIDE`, size: "M", color: "Black", price: D("24.50"), stock: 50 },
                    { sku: `P8-${RUN}-WHOLE`, size: "L", color: "Black", price: D("10"), stock: 50 },
                ],
            },
        },
        include: { variants: { orderBy: { id: "asc" } } },
    });
    [fallback, override, whole] = product.variants;
});

after(async () => {
    try {
        const orders = await prisma.order.findMany({ where: { userId: { in: userIds } } });
        for (const order of orders.filter((o) => o.status !== "CANCELLED")) {
            await prisma.order.update({ where: { id: order.id }, data: { status: "PENDING", paymentStatus: "UNPAID" } });
            await cancelOrder(order.userId, order.id);
        }
        for (const v of product.variants) assert.equal(await stockOf(v.id), 50, "fixture stock restored");

        await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.cartItem.deleteMany({ where: { cart: { userId: { in: userIds } } } });
        await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        await prisma.product.delete({ where: { id: product.id } }); // variants cascade
    } finally {
        await server.stop();
        await prisma.$disconnect();
    }
});

test("product detail, cart and checkout all use the same unit price rule", async () => {
    const detail = (await call("GET", `/products/${product.id}`)).body.data;
    assert.deepEqual(detail.variants.map((v) => v.price), [19.99, 24.5, 10]);

    const user = await shopper("same-price", [[fallback, 1], [override, 1], [whole, 1]]);
    const cart = (await call("GET", "/cart", user)).body.data;
    assert.deepEqual(cart.items.map((i) => i.unitPrice), [19.99, 24.5, 10]);
    assert.equal(cart.subtotal, 54.49);

    const checkout = (await call("GET", "/checkout", user)).body.data;
    assert.deepEqual(checkout.items.map((i) => i.unitPrice), [19.99, 24.5, 10]);
});

test("1/3/4/5/6/7/8/17. server prices the order: lines, subtotal, shipping, tax, discount, total", async () => {
    const user = await shopper("totals", [[fallback, 3], [override, 2], [whole, 1]]);

    const checkout = (await call("GET", "/checkout", user)).body.data;
    assert.deepEqual(Object.keys(checkout.summary).sort(), ["discount", "shipping", "subtotal", "tax", "total"]);
    assert.deepEqual(checkout.summary, { subtotal: 118.97, shipping: 0, tax: 0, discount: 0, total: 118.97 });
    assert.deepEqual(checkout.items.map((i) => i.subtotal), [59.97, 49, 10]);

    const { status, body } = await call("POST", "/orders", user, { addressId: user.addressId });
    assert.equal(status, 201);
    const order = body.data;
    assert.deepEqual(order.items.map((i) => [i.unitPrice, i.quantity, i.lineTotal]), [[19.99, 3, 59.97], [24.5, 2, 49], [10, 1, 10]]);
    assert.deepEqual(
        { subtotal: order.subtotal, shipping: order.shipping, tax: order.tax, discount: order.discount, total: order.total },
        checkout.summary,
        "the stored order total is exactly the checkout total",
    );

    // Stored as exact Decimals that add up.
    const stored = await prisma.order.findUnique({ where: { id: order.id }, include: { items: { orderBy: { id: "asc" } } } });
    assert.deepEqual([stored.subtotal, stored.shipping, stored.tax, stored.discount, stored.total].map((d) => d.toFixed(2)), ["118.97", "0.00", "0.00", "0.00", "118.97"]);
    assert.ok(stored.subtotal.add(stored.shipping).add(stored.tax).sub(stored.discount).equals(stored.total));
    assert.ok(stored.items.reduce((sum, i) => sum.add(i.lineTotal), D(0)).equals(stored.subtotal));
    assert.deepEqual(stored.items.map((i) => i.unitPrice.toFixed(2)), ["19.99", "24.50", "10.00"]);
});

test("2/9/10/11/12. client-supplied prices, shipping, tax, discount and totals are ignored", async () => {
    const user = await shopper("tamper", [[override, 2]]);
    await call("POST", "/cart/items", user, { variantId: whole.id, quantity: 1, unitPrice: 0.01, price: 0.01, subtotal: 0.01 });

    const { status, body } = await call("POST", "/orders", user, {
        addressId: user.addressId,
        unitPrice: 0.01, lineTotal: 0.01, subtotal: 0.01, shipping: -50, tax: -10, discount: 500, total: 0.01,
        paymentStatus: "PAID", status: "DELIVERED",
        items: [{ variantId: override.id, quantity: 99, unitPrice: 0.01, lineTotal: 0.01 }],
    });

    assert.equal(status, 201);
    assert.deepEqual([body.data.subtotal, body.data.shipping, body.data.tax, body.data.discount, body.data.total], [59, 0, 0, 0, 59]);
    assert.deepEqual(body.data.items.map((i) => [i.unitPrice, i.quantity]), [[24.5, 2], [10, 1]]);
    assert.equal(body.data.paymentStatus, "UNPAID");
    assert.equal(body.data.status, "PENDING");
});

test("14/15. order items keep the price charged after the catalog price changes", async () => {
    const user = await shopper("snapshot", [[override, 1], [fallback, 1]]);
    const order = (await call("POST", "/orders", user, { addressId: user.addressId })).body.data;

    await prisma.productVariant.update({ where: { id: override.id }, data: { price: D("99.99") } });
    await prisma.product.update({ where: { id: product.id }, data: { price: D("1.00") } });
    try {
        const after = (await call("GET", `/orders/${order.id}`, user)).body.data;
        assert.deepEqual(after.items.map((i) => [i.unitPrice, i.lineTotal]), [[24.5, 24.5], [19.99, 19.99]]);
        assert.equal(after.total, 44.49);
        assert.equal((await call("GET", "/orders", user)).body.data[0].total, 44.49);

        // New carts see the new prices.
        const next = await shopper("snapshot-next", [[override, 1], [fallback, 1]]);
        assert.equal((await call("GET", "/checkout", next)).body.data.summary.total, 100.99);
    } finally {
        await prisma.productVariant.update({ where: { id: override.id }, data: { price: D("24.50") } });
        await prisma.product.update({ where: { id: product.id }, data: { price: D("19.99") } });
    }
});

test("16/18. price change between checkout and order: stale expectedTotal is rejected, current price is used", async () => {
    const user = await shopper("stale", [[override, 2]]);
    const shown = (await call("GET", "/checkout", user)).body.data.summary.total;
    assert.equal(shown, 49);
    const stockBefore = await stockOf(override.id);

    await prisma.productVariant.update({ where: { id: override.id }, data: { price: D("25.75") } });
    try {
        const stale = await call("POST", "/orders", user, { addressId: user.addressId, expectedTotal: shown });
        assert.equal(stale.status, 409);
        assert.equal(stale.body.details[0].code, "PRICE_CHANGED");
        assert.equal(await prisma.order.count({ where: { userId: user.id } }), 0, "no order");
        assert.equal(await stockOf(override.id), stockBefore, "stock untouched");
        assert.equal((await call("GET", "/cart", user)).body.data.items.length, 1, "cart untouched");

        // Reconcile: checkout now shows the new total, and that one is accepted.
        const fresh = (await call("GET", "/checkout", user)).body.data.summary.total;
        assert.equal(fresh, 51.5);
        const ok = await call("POST", "/orders", user, { addressId: user.addressId, expectedTotal: fresh });
        assert.equal(ok.status, 201);
        assert.equal(ok.body.data.total, 51.5);
        assert.equal(ok.body.data.items[0].unitPrice, 25.75);
    } finally {
        await prisma.productVariant.update({ where: { id: override.id }, data: { price: D("24.50") } });
    }
});

test("16. expectedTotal: string form accepted; malformed values rejected", async () => {
    const user = await shopper("expected", [[whole, 3]]);
    for (const bad of ["abc", -1, "1.234", "-0.01"]) {
        assert.equal((await call("POST", "/orders", user, { addressId: user.addressId, expectedTotal: bad })).status, 422, String(bad));
    }
    const ok = await call("POST", "/orders", user, { addressId: user.addressId, expectedTotal: "30.00" });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.total, 30);
    assert.ok(!("expectedTotal" in ok.body.data));
});

test("18. a client without expectedTotal still gets the current server price", async () => {
    const user = await shopper("no-expected", [[fallback, 2]]);
    await prisma.product.update({ where: { id: product.id }, data: { price: D("21.10") } });
    try {
        const { status, body } = await call("POST", "/orders", user, { addressId: user.addressId });
        assert.equal(status, 201);
        assert.equal(body.data.total, 42.2);
    } finally {
        await prisma.product.update({ where: { id: product.id }, data: { price: D("19.99") } });
    }
});

test("19. orders are created unpaid; nothing marks them paid", async () => {
    const user = await shopper("unpaid", [[whole, 1]]);
    const order = (await call("POST", "/orders", user, { addressId: user.addressId })).body.data;

    assert.equal(order.paymentStatus, "UNPAID");
    assert.equal(order.status, "PENDING");
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).paymentStatus, "UNPAID");
    assert.equal((await call("GET", `/orders/${order.id}`, user)).body.data.paymentStatus, "UNPAID");
});

test("20. cancellation still restores stock; a paid order cannot be self-cancelled", async () => {
    const user = await shopper("cancel", [[override, 4], [fallback, 1]]);
    const before = [await stockOf(override.id), await stockOf(fallback.id)];
    const order = (await call("POST", "/orders", user, { addressId: user.addressId })).body.data;
    assert.deepEqual([await stockOf(override.id), await stockOf(fallback.id)], [before[0] - 4, before[1] - 1]);

    const res = await call("POST", `/orders/${order.id}/cancel`, user);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.paymentStatus, "UNPAID");
    assert.deepEqual([await stockOf(override.id), await stockOf(fallback.id)], before);

    // Readiness guard: once payment exists, a PAID order needs a refund flow first.
    await call("POST", "/cart/items", user, { variantId: whole.id, quantity: 1 });
    const paid = (await call("POST", "/orders", user, { addressId: user.addressId })).body.data;
    await prisma.order.update({ where: { id: paid.id }, data: { paymentStatus: "PAID" } });
    const reserved = await stockOf(whole.id);
    assert.equal((await call("GET", `/orders/${paid.id}`, user)).body.data.cancellable, false);
    const blocked = await call("POST", `/orders/${paid.id}/cancel`, user);
    assert.equal(blocked.status, 409);
    assert.equal(await stockOf(whole.id), reserved);
});
