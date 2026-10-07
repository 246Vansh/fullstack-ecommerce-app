// Order history, detail, cancellation and address ownership.
// Each scenario uses its own throwaway user (so the per-user order limit and
// carts never collide). Every order is cancelled (restoring stock) and every
// test row deleted in after(), which also checks stock ended where it started.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import prisma from "../config/db.js";
import { signAccessToken } from "../utils/jwt.js";
import { cancelOrder } from "../services/orderService.js";
import { startServer } from "./helpers.js";

const RUN = crypto.randomBytes(4).toString("hex");
const userIds = [];
let server, variants, stockBefore;

const ADDRESS = {
    firstName: "Test", lastName: "Buyer", phone: "5551234567", address: "1 Phase Seven Street",
    city: "Austin", state: "TX", zipCode: "73301", country: "United States",
};

async function makeUser(label) {
    const user = await prisma.user.create({
        data: { email: `phase7-${label}-${RUN}@example.test`, passwordHash: "not-a-login", firstName: "Test", lastName: label, role: "CUSTOMER" },
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

const stockOf = async (id) => (await prisma.productVariant.findUnique({ where: { id }, select: { stock: true } })).stock;
const stocks = async () => Promise.all(variants.map((v) => stockOf(v.id)));

async function addAddress(user) {
    const { status, body } = await call("POST", "/addresses", user, ADDRESS);
    assert.equal(status, 201, JSON.stringify(body));
    return body.data;
}

// Places an order for [[variant, quantity], ...]; returns the created order.
async function placeOrder(user, lines, addressId) {
    addressId ??= (await addAddress(user)).id;
    for (const [variant, quantity] of lines) {
        const { status } = await call("POST", "/cart/items", user, { variantId: variant.id, quantity });
        assert.equal(status, 201);
    }
    const { status, body } = await call("POST", "/orders", user, { addressId });
    assert.equal(status, 201, JSON.stringify(body));
    return body.data;
}

before(async () => {
    server = await startServer();
    // Three active, well-stocked variants of different active products.
    const rows = await prisma.productVariant.findMany({
        where: { isActive: true, stock: { gte: 10 }, product: { isActive: true } },
        include: { product: { select: { id: true, price: true } } },
        orderBy: { id: "asc" },
    });
    variants = rows.filter((v, i) => rows.findIndex((w) => w.productId === v.productId) === i).slice(0, 3)
        .map((v) => ({ id: v.id, price: Number(v.price ?? v.product.price) }));
    assert.equal(variants.length, 3);
    stockBefore = await stocks();
});

after(async () => {
    try {
        // Undo every test order through the real cancellation path.
        const orders = await prisma.order.findMany({ where: { userId: { in: userIds } } });
        for (const order of orders.filter((o) => o.status !== "CANCELLED")) {
            await prisma.order.update({ where: { id: order.id }, data: { status: "PENDING" } });
            await cancelOrder(order.userId, order.id);
        }
        assert.deepEqual(await stocks(), stockBefore, "stock is back to its starting values");

        await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.cartItem.deleteMany({ where: { cart: { userId: { in: userIds } } } });
        await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
        await server.stop();
        await prisma.$disconnect();
    }
});

test("19. a valid order is created, priced by the server, and empties the cart", async () => {
    const a = await makeUser("create");
    const [before0] = await stocks();
    const order = await placeOrder(a, [[variants[0], 2]]);

    assert.equal(order.status, "PENDING");
    assert.equal(order.total, +(variants[0].price * 2).toFixed(2));
    assert.equal(await stockOf(variants[0].id), before0 - 2);
    assert.equal((await call("GET", "/cart", a)).body.data.items.length, 0);
});

test("1. user lists their own orders, newest first, with list fields only", async () => {
    const a = await makeUser("list");
    const first = await placeOrder(a, [[variants[0], 1], [variants[1], 2]]);
    const second = await placeOrder(a, [[variants[2], 1]]);

    const { status, body } = await call("GET", "/orders", a);
    assert.equal(status, 200);
    assert.deepEqual(body.data.map((o) => o.id), [second.id, first.id]);
    assert.deepEqual(Object.keys(body.data[0]).sort(), ["createdAt", "id", "itemCount", "orderNumber", "status", "total"]);
    assert.equal(body.data[1].itemCount, 3);
    assert.equal(body.data[1].total, first.total);

    const empty = await makeUser("empty");
    assert.deepEqual((await call("GET", "/orders", empty)).body.data, []);
});

test("2. unauthenticated requests are rejected", async () => {
    assert.equal((await call("GET", "/orders")).status, 401);
    assert.equal((await call("GET", "/orders/1")).status, 401);
    assert.equal((await call("POST", "/orders/1/cancel")).status, 401);
    assert.equal((await call("DELETE", "/addresses/1")).status, 401);
});

test("3/4/5. order detail: own order only; others and missing ids are 404", async () => {
    const a = await makeUser("owner");
    const b = await makeUser("other");
    const order = await placeOrder(a, [[variants[0], 1]]);

    const own = await call("GET", `/orders/${order.id}`, a);
    assert.equal(own.status, 200);
    assert.equal(own.body.data.orderNumber, order.orderNumber);
    assert.equal(own.body.data.cancellable, true);
    assert.ok(own.body.data.updatedAt && own.body.data.createdAt);
    assert.equal(own.body.data.shippingAddress.address, ADDRESS.address);
    assert.equal(own.body.data.items[0].quantity, 1);
    for (const field of ["userId", "notes", "deliveryMethod", "passwordHash"]) {
        assert.ok(!(field in own.body.data), `${field} is not exposed`);
    }

    const foreign = await call("GET", `/orders/${order.id}`, b);
    assert.equal(foreign.status, 404);
    assert.deepEqual(foreign.body, (await call("GET", "/orders/999999999", b)).body, "same response as a missing order");
    assert.ok(!(await call("GET", "/orders", b)).body.data.some((o) => o.id === order.id));

    assert.equal((await call("GET", "/orders/999999999", a)).status, 404);
    assert.equal((await call("GET", "/orders/abc", a)).status, 422, "malformed id fails validation");
});

test("6/7. a pending order is cancelled and its stock restored", async () => {
    const a = await makeUser("cancel");
    const start = await stockOf(variants[0].id);
    const order = await placeOrder(a, [[variants[0], 3]]);
    assert.equal(await stockOf(variants[0].id), start - 3);

    const { status, body } = await call("POST", `/orders/${order.id}/cancel`, a);
    assert.equal(status, 200);
    assert.equal(body.data.status, "CANCELLED");
    assert.equal(body.data.cancellable, false);
    assert.equal(await stockOf(variants[0].id), start);
});

test("8. multi-item cancellation restores every variant", async () => {
    const a = await makeUser("multi");
    const start = await stocks();
    const order = await placeOrder(a, [[variants[0], 2], [variants[1], 1], [variants[2], 4]]);
    assert.deepEqual(await stocks(), [start[0] - 2, start[1] - 1, start[2] - 4]);

    assert.equal((await call("POST", `/orders/${order.id}/cancel`, a)).status, 200);
    assert.deepEqual(await stocks(), start);
});

test("9. cancelling an already cancelled order is rejected without touching stock", async () => {
    const a = await makeUser("twice");
    const order = await placeOrder(a, [[variants[1], 2]]);
    assert.equal((await call("POST", `/orders/${order.id}/cancel`, a)).status, 200);
    const restored = await stockOf(variants[1].id);

    const again = await call("POST", `/orders/${order.id}/cancel`, a);
    assert.equal(again.status, 409);
    assert.equal(again.body.message, "This order has already been cancelled");
    assert.equal(await stockOf(variants[1].id), restored);
});

test("10. simultaneous cancellations restore stock exactly once", async () => {
    const a = await makeUser("race");
    const start = await stocks();
    const order = await placeOrder(a, [[variants[0], 2], [variants[2], 1]]);

    const results = await Promise.all(Array.from({ length: 5 }, () => call("POST", `/orders/${order.id}/cancel`, a)));
    const statuses = results.map((r) => r.status).sort();

    assert.deepEqual(statuses, [200, 409, 409, 409, 409]);
    assert.deepEqual(await stocks(), start, "restored once, not five times");
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, "CANCELLED");
});

test("11. shipped or delivered orders cannot be cancelled", async () => {
    const a = await makeUser("shipped");
    const order = await placeOrder(a, [[variants[1], 1]]);
    const reserved = await stockOf(variants[1].id);

    for (const status of ["SHIPPED", "DELIVERED", "PROCESSING"]) {
        await prisma.order.update({ where: { id: order.id }, data: { status } });
        const res = await call("POST", `/orders/${order.id}/cancel`, a);
        assert.equal(res.status, 409, status);
        assert.equal(res.body.message, "This order can no longer be cancelled");
        assert.equal((await call("GET", `/orders/${order.id}`, a)).body.data.cancellable, false);
    }
    assert.equal(await stockOf(variants[1].id), reserved);
});

test("12/20. another user cannot cancel; ownership holds after cancellation", async () => {
    const a = await makeUser("victim");
    const b = await makeUser("attacker");
    const order = await placeOrder(a, [[variants[2], 1]]);
    const reserved = await stockOf(variants[2].id);

    const attempt = await call("POST", `/orders/${order.id}/cancel`, b);
    assert.equal(attempt.status, 404);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, "PENDING");
    assert.equal(await stockOf(variants[2].id), reserved);

    assert.equal((await call("POST", `/orders/${order.id}/cancel`, a)).status, 200);
    assert.equal((await call("GET", `/orders/${order.id}`, b)).status, 404);
    assert.equal((await call("POST", `/orders/${order.id}/cancel`, b)).status, 404);
    assert.equal((await call("GET", `/orders/${order.id}`, a)).body.data.status, "CANCELLED");
});

test("cancellation rolls back completely if a step fails", async () => {
    const a = await makeUser("rollback");
    const order = await placeOrder(a, [[variants[0], 1], [variants[1], 2]]);
    const reserved = await stocks();

    // Fail after the first variant's stock was restored, inside the transaction.
    await assert.rejects(
        cancelOrder(a.id, order.id, { afterStep: (name) => { if (name === "restore") throw new Error("injected failure"); } }),
        /injected failure/,
    );

    assert.deepEqual(await stocks(), reserved, "no stock restored");
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, "PENDING", "status unchanged");

    assert.equal((await call("POST", `/orders/${order.id}/cancel`, a)).status, 200, "a later cancel still works");
});

test("13/14. invalid or foreign addressId is rejected, with no fallback", async () => {
    const a = await makeUser("addr-a");
    const b = await makeUser("addr-b");
    await addAddress(a); // a has a valid address that must NOT be used as a fallback
    const bAddress = await addAddress(b);
    await call("POST", "/cart/items", a, { variantId: variants[0].id, quantity: 1 });
    const reserved = await stocks();

    const missing = await call("POST", "/orders", a, { addressId: 999999999 });
    const foreign = await call("POST", "/orders", a, { addressId: bAddress.id });
    assert.equal(missing.status, 404);
    assert.equal(foreign.status, 404);
    assert.deepEqual(foreign.body, missing.body, "foreign address looks exactly like a missing one");

    for (const addressId of [undefined, "abc", 0, -1]) {
        assert.equal((await call("POST", "/orders", a, { addressId })).status, 422, String(addressId));
    }

    assert.equal(await prisma.order.count({ where: { userId: a.id } }), 0, "no order created");
    assert.equal((await call("GET", "/cart", a)).body.data.items.length, 1, "cart untouched");
    assert.deepEqual(await stocks(), reserved, "stock untouched");
});

test("insufficient stock: order is rejected and nothing changes", async () => {
    const a = await makeUser("stock");
    const address = await addAddress(a);
    await call("POST", "/cart/items", a, { variantId: variants[1].id, quantity: 1 });
    const available = await stockOf(variants[1].id);
    await prisma.cartItem.updateMany({ where: { cart: { userId: a.id } }, data: { quantity: available + 1 } });

    const res = await call("POST", "/orders", a, { addressId: address.id });
    assert.equal(res.status, 409);
    assert.equal(await stockOf(variants[1].id), available, "stock never goes negative");
    assert.equal(await prisma.order.count({ where: { userId: a.id } }), 0);
});

test("15/16/17. address delete: owner only, and orders keep their snapshot", async () => {
    const a = await makeUser("del-a");
    const b = await makeUser("del-b");
    const address = await addAddress(a);
    const order = await placeOrder(a, [[variants[2], 1]], address.id);
    const snapshot = (await call("GET", `/orders/${order.id}`, a)).body.data.shippingAddress;

    const foreign = await call("DELETE", `/addresses/${address.id}`, b);
    assert.equal(foreign.status, 404);
    assert.ok(await prisma.address.findUnique({ where: { id: address.id } }), "still exists");

    assert.equal((await call("DELETE", "/addresses/999999999", a)).status, 404);

    assert.equal((await call("DELETE", `/addresses/${address.id}`, a)).status, 200);
    assert.ok(!(await call("GET", "/addresses", a)).body.data.some((x) => x.id === address.id));

    const after = await call("GET", `/orders/${order.id}`, a);
    assert.equal(after.status, 200);
    assert.deepEqual(after.body.data.shippingAddress, snapshot, "order shipping info unchanged");
});

test("18. client-supplied totals, prices, owner and status are ignored", async () => {
    const a = await makeUser("tamper");
    const b = await makeUser("tamper-b");
    const address = await addAddress(a);
    await call("POST", "/cart/items", a, { variantId: variants[0].id, quantity: 2, unitPrice: 0.01, price: 0.01 });

    const { status, body } = await call("POST", "/orders", a, {
        addressId: address.id,
        total: 0.01, subtotal: 0.01, expectedTotal: 0.01, discount: 999,
        userId: b.id, status: "DELIVERED",
        items: [{ variantId: variants[0].id, quantity: 100, unitPrice: 0.01 }],
    });

    assert.equal(status, 201);
    const expected = +(variants[0].price * 2).toFixed(2);
    assert.equal(body.data.total, expected);
    assert.equal(body.data.discount, 0);
    assert.equal(body.data.status, "PENDING");
    assert.equal(body.data.items[0].quantity, 2);
    const stored = await prisma.order.findUnique({ where: { id: body.data.id } });
    assert.equal(stored.userId, a.id);
    assert.equal(Number(stored.total), expected);
});

test("4. order mutations (create + cancel) share a per-user limit", async () => {
    const a = await makeUser("limit");
    const address = await addAddress(a);

    for (let i = 0; i < 5; i++) {
        const order = await placeOrder(a, [[variants[0], 1]], address.id);
        assert.equal((await call("POST", `/orders/${order.id}/cancel`, a)).status, 200);
    }

    await call("POST", "/cart/items", a, { variantId: variants[0].id, quantity: 1 });
    const blocked = await call("POST", "/orders", a, { addressId: address.id });
    assert.equal(blocked.status, 429);

    // Reads and other users are unaffected.
    assert.equal((await call("GET", "/orders", a)).status, 200);
    const other = await makeUser("limit-other");
    assert.equal((await call("GET", "/orders", other)).status, 200);
});
