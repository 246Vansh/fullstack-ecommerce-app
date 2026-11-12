// Coupons: discount maths, every validation rule, admin management and its
// authorisation, checkout preview, order creation, and the usage lifecycle
// (claimed with the order, given back on cancel/expiry, taken again by a late
// payment) including concurrent orders racing for the last uses.
//
// Razorpay is never called: online orders are placed in this process, and a
// late payment is applied with reinstateExpiredOrder and a made-up payment.
//
// Fixtures: a category, a USD and an INR product, users, coupons and orders,
// all created by this run (codes and emails carry RUN) and deleted in after(),
// in the test database named by TEST_DATABASE_URL (see testDatabase.js);
// unset, the integration tests are skipped. The unit tests always run.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

import { signAccessToken } from "../utils/jwt.js";
import { calculateTotals, couponDiscountOf } from "../services/pricingService.js";
import { startServer } from "./helpers.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

const { guard, skip, prisma } = await openTestDatabase();
const orders = guard.ok ? await import("../services/orderService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const D = (value) => new Prisma.Decimal(value);
const RUN = crypto.randomBytes(4).toString("hex").toUpperCase();
const created = { users: [], products: [], categories: [], coupons: [] };
let server, usd, inr, admin, sequence = 0;

const DAY = 24 * 60 * 60 * 1000;
const codeFor = (label) => `${label}-${RUN}`.toUpperCase();

// ---------------------------------------------------------------- unit tests

test("unit: percentage discount is rounded half up to cents and capped by maximumDiscountAmount", () => {
    const pct = (value, max = null) => ({ discountType: "PERCENTAGE", discountValue: D(value), maximumDiscountAmount: max == null ? null : D(max) });

    assert.equal(couponDiscountOf(pct(10), D("40.00")).toFixed(2), "4.00");
    assert.equal(couponDiscountOf(pct(15), D("33.33")).toFixed(2), "5.00", "4.9995 rounds half up");
    assert.equal(couponDiscountOf(pct("12.5"), D("0.04")).toFixed(2), "0.01", "0.005 rounds up");
    assert.equal(couponDiscountOf(pct(50, 5), D("40.00")).toFixed(2), "5.00", "capped");
    assert.equal(couponDiscountOf(pct(50, 500), D("40.00")).toFixed(2), "20.00", "cap above the discount changes nothing");
    assert.equal(couponDiscountOf(pct(100), D("40.00")).toFixed(2), "40.00");
});

test("unit: fixed discount never exceeds the subtotal; totals stay consistent and never negative", () => {
    const fixed = (value) => ({ discountType: "FIXED", discountValue: D(value), maximumDiscountAmount: null });

    assert.equal(couponDiscountOf(fixed(15), D("40.00")).toFixed(2), "15.00");
    assert.equal(couponDiscountOf(fixed(200), D("40.00")).toFixed(2), "40.00");

    const items = [{ unitPrice: D("19.99"), quantity: 3 }];
    const totals = calculateTotals(items, { coupon: fixed(200) });
    assert.equal(totals.subtotal.toFixed(2), "59.97");
    assert.equal(totals.discount.toFixed(2), "59.97");
    assert.equal(totals.total.toFixed(2), "0.00");
    assert.ok(totals.subtotal.add(totals.shipping).add(totals.tax).sub(totals.discount).equals(totals.total));

    const none = calculateTotals(items);
    assert.equal(none.discount.toFixed(2), "0.00", "no coupon, no discount (unchanged pricing)");
    assert.equal(none.total.toFixed(2), "59.97");
});

// ---------------------------------------------------------------- helpers

async function makeUser(label, role = "CUSTOMER") {
    const user = await prisma.user.create({
        data: { email: `coupons-${label}-${RUN}-${++sequence}@example.test`.toLowerCase(), passwordHash: "not-a-login", firstName: "Cpn", lastName: label, role },
    });
    created.users.push({ id: user.id, email: user.email });
    const address = role === "CUSTOMER" ? await prisma.address.create({
        data: {
            userId: user.id, firstName: "Cpn", lastName: label, phone: "5550000000", address: "1 Coupon Rd",
            city: "Austin", state: "TX", zipCode: "73301", country: "United States", isDefault: true,
        },
    }) : null;
    return { id: user.id, addressId: address?.id, headers: { Authorization: `Bearer ${signAccessToken(user)}` } };
}

async function call(method, path, user, body) {
    const res = await fetch(`${server.url}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(user?.headers ?? {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
}

// Replaces the user's cart with `quantity` of the fixture product (20.00 USD each by default).
async function fillCart(user, { product = usd, quantity = 2 } = {}) {
    const cart = await prisma.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await prisma.cartItem.create({ data: { cartId: cart.id, variantId: product.variantId, quantity } });
}

async function makeCoupon(label, data = {}) {
    const coupon = await prisma.coupon.create({
        data: { code: codeFor(label), discountType: "PERCENTAGE", discountValue: "10", currency: "USD", startsAt: new Date(Date.now() - DAY), ...data },
    });
    created.coupons.push({ id: coupon.id, code: coupon.code });
    return coupon;
}

const usedCount = async (coupon) => (await prisma.coupon.findUnique({ where: { id: coupon.id }, select: { usedCount: true } })).usedCount;
const stockOf = async (product) => (await prisma.productVariant.findUnique({ where: { id: product.variantId }, select: { stock: true } })).stock;

const place = (user, couponCode, extra = {}) => orders.createOrder(user.id, { addressId: user.addressId, paymentMethod: "COD", couponCode, ...extra });

const rejectsWith = (promise, status, code) => assert.rejects(promise, (err) => {
    assert.equal(err.statusCode, status, err.message);
    if (code) assert.equal(err.details?.[0]?.code, code, err.message);
    return true;
});

// ---------------------------------------------------------------- fixtures

before(async () => {
    if (!guard.ok) return;

    await assertOnTestDatabase(prisma);

    const slug = `coupons-${RUN}`.toLowerCase();
    const category = await prisma.category.create({ data: { name: `Coupons ${RUN}`, slug } });
    created.categories.push({ id: category.id, slug });

    const product = async (suffix, price, currency) => {
        const row = await prisma.product.create({
            data: {
                categoryId: category.id, name: `Coupons ${RUN} ${suffix}`, slug: `${slug}-${suffix}`, price, currency, isActive: true,
                variants: { create: [{ sku: `CPN-${RUN}-${suffix}`.toUpperCase(), size: "M", color: "Black", stock: 1000 }] },
            },
            include: { variants: true },
        });
        created.products.push({ id: row.id, slug: row.slug });
        return { id: row.id, variantId: row.variants[0].id };
    };

    usd = await product("usd", "20.00", "USD");
    inr = await product("inr", "500.00", "INR");
    admin = await makeUser("admin", "ADMIN");

    server = await startServer(testServerEnv(guard));

    const probe = await call("GET", `/products/${usd.id}`);
    assert.equal(probe.body?.data?.name, `Coupons ${RUN} usd`, "server is on the test database");
});

after(async () => {
    if (!guard.ok) return;

    try {
        const userIds = created.users.map((u) => u.id);
        await deleteInTestDatabase(prisma, async (tx) => {
            await tx.unappliedPayment.deleteMany({ where: { order: { userId: { in: userIds } } } });
            await tx.order.deleteMany({ where: { userId: { in: userIds } } });
            await tx.cartItem.deleteMany({ where: { cart: { userId: { in: userIds } } } });
            await tx.cart.deleteMany({ where: { userId: { in: userIds } } });
            await tx.address.deleteMany({ where: { userId: { in: userIds } } });
            // Coupons this run created (some were deleted by the tests themselves).
            await tx.coupon.deleteMany({
                where: { id: { in: created.coupons.map((c) => c.id) }, code: { in: created.coupons.map((c) => c.code) } },
            });
            const leftovers = await tx.coupon.count({ where: { code: { endsWith: `-${RUN}` } } });
            if (leftovers) throw new Error(`${leftovers} coupons of this run were not tracked`);
            expectDeleted("users", await tx.user.deleteMany({
                where: { id: { in: userIds }, email: { in: created.users.map((u) => u.email) } },
            }), created.users.length);
            expectDeleted("products", await tx.product.deleteMany({
                where: { id: { in: created.products.map((p) => p.id) }, slug: { in: created.products.map((p) => p.slug) } },
            }), created.products.length);
            expectDeleted("categories", await tx.category.deleteMany({
                where: { id: { in: created.categories.map((c) => c.id) }, slug: { in: created.categories.map((c) => c.slug) } },
            }), created.categories.length);
        });
    } finally {
        await server?.stop();
        await prisma.$disconnect();
    }
});

// ---------------------------------------------------------------- admin

dbTest("admin: only authenticated administrators can manage coupons", async () => {
    const customer = await makeUser("not-admin");
    const coupon = await makeCoupon("AUTHZ");
    const valid = { code: codeFor("NOPE"), discountType: "FIXED", discountValue: 5, currency: "USD" };

    for (const user of [null, customer]) {
        const expected = user ? 403 : 401;
        assert.equal((await call("GET", "/admin/coupons", user)).status, expected);
        assert.equal((await call("POST", "/admin/coupons", user, valid)).status, expected);
        assert.equal((await call("GET", `/admin/coupons/${coupon.id}`, user)).status, expected);
        assert.equal((await call("PATCH", `/admin/coupons/${coupon.id}`, user, { discountValue: 99 })).status, expected);
        assert.equal((await call("POST", `/admin/coupons/${coupon.id}/deactivate`, user)).status, expected);
        assert.equal((await call("DELETE", `/admin/coupons/${coupon.id}`, user)).status, expected);
    }

    assert.equal(await prisma.coupon.count({ where: { code: valid.code } }), 0, "nothing was created");
    const after = await prisma.coupon.findUnique({ where: { id: coupon.id } });
    assert.equal(after.isActive, true);
    assert.equal(after.discountValue.toFixed(2), "10.00");
});

dbTest("admin: create normalises the code, refuses duplicates in any case, and lists/filters", async () => {
    const res = await call("POST", "/admin/coupons", admin, {
        code: `  welcome10-${RUN.toLowerCase()} `, description: "Welcome offer", discountType: "PERCENTAGE",
        discountValue: "10", currency: "USD", maximumDiscountAmount: 25, usageLimit: 100, usageLimitPerUser: 1,
        startsAt: "2026-01-01T00:00:00Z", expiresAt: "2099-12-31T23:59:59.000Z",
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    created.coupons.push({ id: res.body.data.id, code: res.body.data.code });
    assert.equal(res.body.data.code, `WELCOME10-${RUN}`);
    assert.equal(res.body.data.status, "ACTIVE");
    assert.equal(res.body.data.usedCount, 0);
    assert.equal(res.body.data.minimumOrderAmount, 0);
    assert.equal(res.body.data.deletable, true);
    assert.equal(res.body.data.startsAt, "2026-01-01T00:00:00.000Z");
    assert.equal(res.body.data.expiresAt, "2099-12-31T23:59:59.000Z");

    const again = await call("POST", "/admin/coupons", admin, { code: `Welcome10-${RUN}`, discountType: "FIXED", discountValue: 5, currency: "USD" });
    assert.equal(again.status, 409);
    assert.equal(again.body.message, "A coupon with this code already exists");

    const listed = await call("GET", `/admin/coupons?search=welcome10-${RUN.toLowerCase()}`, admin);
    assert.equal(listed.status, 200);
    assert.deepEqual(listed.body.data.map((c) => c.code), [`WELCOME10-${RUN}`]);
    assert.equal(listed.body.pagination.total, 1);

    const inactiveOnly = await call("GET", `/admin/coupons?search=welcome10-${RUN}&isActive=false`, admin);
    assert.deepEqual(inactiveOnly.body.data, []);
});

dbTest("admin: invalid, negative and inconsistent values are refused", async () => {
    const base = { code: codeFor("BAD"), discountType: "PERCENTAGE", discountValue: 10, currency: "USD" };
    const cases = [
        [{ ...base, discountValue: -5 }, "discountValue"],
        [{ ...base, discountValue: 0 }, "discountValue"],
        [{ ...base, discountValue: "1.234" }, "discountValue"],
        [{ ...base, discountValue: 150 }, "discountValue"],
        [{ ...base, discountType: "BOGO" }, "discountType"],
        [{ ...base, currency: "EUR" }, "currency"],
        [{ ...base, code: "a" }, "code"],
        [{ ...base, code: "has space" }, "code"],
        [{ ...base, minimumOrderAmount: -1 }, "minimumOrderAmount"],
        [{ ...base, usageLimit: 0 }, "usageLimit"],
        [{ ...base, usageLimit: 1.5 }, "usageLimit"],
        [{ ...base, usageLimit: 2, usageLimitPerUser: 3 }, "usageLimitPerUser"],
        [{ ...base, discountType: "FIXED", maximumDiscountAmount: 5 }, "maximumDiscountAmount"],
        [{ ...base, startsAt: "2030-01-02T00:00:00Z", expiresAt: "2030-01-01T00:00:00Z" }, "expiresAt"],
        [{ ...base, expiresAt: "tomorrow" }, "expiresAt"],
        [{ ...base, code: undefined }, "code"],
    ];

    for (const [body, field] of cases) {
        const res = await call("POST", "/admin/coupons", admin, body);
        assert.equal(res.status, 422, `${field}: ${JSON.stringify(body)}`);
        assert.equal(res.body.details?.[0]?.field, field, JSON.stringify(res.body));
    }

    assert.equal(await prisma.coupon.count({ where: { code: base.code } }), 0);
});

dbTest("admin: update, activate/deactivate, usage details, and delete only while unused", async () => {
    const coupon = await makeCoupon("MANAGE", { usageLimit: 10 });

    const patched = await call("PATCH", `/admin/coupons/${coupon.id}`, admin, { discountType: "FIXED", discountValue: "7.50", description: null });
    assert.equal(patched.status, 200, JSON.stringify(patched.body));
    assert.equal(patched.body.data.discountType, "FIXED");
    assert.equal(patched.body.data.discountValue, 7.5);
    assert.equal((await call("PATCH", `/admin/coupons/${coupon.id}`, admin, {})).status, 422, "empty PATCH");
    assert.equal((await call("PATCH", `/admin/coupons/${coupon.id}`, admin, { usedCount: 0 })).status, 422, "usedCount is not editable");

    const off = await call("POST", `/admin/coupons/${coupon.id}/deactivate`, admin);
    assert.equal(off.body.data.isActive, false);
    assert.equal(off.body.data.status, "INACTIVE");
    const on = await call("POST", `/admin/coupons/${coupon.id}/activate`, admin);
    assert.equal(on.body.data.isActive, true);

    // Used by one order: details show it, the limit cannot drop below the
    // uses held, and it can no longer be deleted.
    const customer = await makeUser("manage");
    await fillCart(customer);
    const order = await place(customer, coupon.code);

    const detail = await call("GET", `/admin/coupons/${coupon.id}`, admin);
    assert.equal(detail.body.data.usedCount, 1);
    assert.equal(detail.body.data.orderCount, 1);
    assert.equal(detail.body.data.deletable, false);
    assert.deepEqual(detail.body.data.recentOrders.map((o) => o.orderNumber), [order.orderNumber]);
    assert.equal(detail.body.data.recentOrders[0].discount, 7.5);

    const lowered = await call("PATCH", `/admin/coupons/${coupon.id}`, admin, { usageLimit: 1 });
    assert.equal(lowered.status, 200, "equal to the uses held is fine");
    assert.equal(lowered.body.data.status, "USED_UP");

    const refused = await call("DELETE", `/admin/coupons/${coupon.id}`, admin);
    assert.equal(refused.status, 409);
    assert.match(refused.body.message, /can only be deactivated/);
    assert.ok(await prisma.coupon.findUnique({ where: { id: coupon.id } }), "still there");

    const unused = await makeCoupon("UNUSED");
    const deleted = await call("DELETE", `/admin/coupons/${unused.id}`, admin);
    assert.equal(deleted.status, 200);
    assert.equal(await prisma.coupon.findUnique({ where: { id: unused.id } }), null);
    assert.equal((await call("GET", `/admin/coupons/${unused.id}`, admin)).status, 404);
});

dbTest("admin: usageLimit cannot be set below the uses already held", async () => {
    const coupon = await makeCoupon("FLOOR");
    const users = [await makeUser("floor-a"), await makeUser("floor-b")];
    for (const user of users) {
        await fillCart(user);
        await place(user, coupon.code);
    }

    const res = await call("PATCH", `/admin/coupons/${coupon.id}`, admin, { usageLimit: 1 });
    assert.equal(res.status, 422);
    assert.equal(res.body.details[0].field, "usageLimit");
    assert.equal((await prisma.coupon.findUnique({ where: { id: coupon.id } })).usageLimit, null);
});

// ---------------------------------------------------------------- customer: validation

dbTest("checkout: a valid percentage coupon is priced by the server; validating takes no use", async () => {
    const coupon = await makeCoupon("PCT", { discountValue: "15", description: "15% off" });
    const customer = await makeUser("pct");
    await fillCart(customer); // 2 x 20.00

    const validated = await call("POST", "/coupons/validate", customer, { couponCode: `  ${coupon.code.toLowerCase()} ` });
    assert.equal(validated.status, 200, JSON.stringify(validated.body));
    assert.equal(validated.body.data.coupon.code, coupon.code);
    assert.equal(validated.body.data.coupon.discount, 6);
    assert.deepEqual(
        { subtotal: validated.body.data.summary.subtotal, discount: validated.body.data.summary.discount, total: validated.body.data.summary.total },
        { subtotal: 40, discount: 6, total: 34 },
    );

    const checkout = await call("GET", `/checkout?couponCode=${coupon.code}`, customer);
    assert.equal(checkout.status, 200);
    assert.equal(checkout.body.data.summary.discount, 6);
    assert.equal(checkout.body.data.summary.total, 34);
    assert.equal(checkout.body.data.coupon.code, coupon.code);
    assert.equal(checkout.body.data.couponError, null);

    const plain = await call("GET", "/checkout", customer);
    assert.equal(plain.body.data.summary.discount, 0, "no coupon: pricing unchanged");
    assert.equal(plain.body.data.coupon, null);

    assert.equal(await usedCount(coupon), 0, "validation never consumes a use");
});

dbTest("checkout: a valid fixed coupon; a fixed amount never exceeds the subtotal", async () => {
    const fixed = await makeCoupon("FIX", { discountType: "FIXED", discountValue: "15" });
    const huge = await makeCoupon("FIXHUGE", { discountType: "FIXED", discountValue: "500" });
    const customer = await makeUser("fixed");
    await fillCart(customer);

    const one = await call("GET", `/checkout?couponCode=${fixed.code}`, customer);
    assert.equal(one.body.data.summary.discount, 15);
    assert.equal(one.body.data.summary.total, 25);

    const two = await call("GET", `/checkout?couponCode=${huge.code}`, customer);
    assert.equal(two.body.data.summary.discount, 40);
    assert.equal(two.body.data.summary.total, 0);
});

dbTest("checkout: the maximum discount cap applies", async () => {
    const coupon = await makeCoupon("CAP", { discountValue: "50", maximumDiscountAmount: "5" });
    const customer = await makeUser("cap");
    await fillCart(customer);

    const res = await call("POST", "/coupons/validate", customer, { couponCode: coupon.code });
    assert.equal(res.body.data.coupon.discount, 5);
    assert.equal(res.body.data.summary.total, 35);
});

dbTest("checkout: expired, inactive, not started, unknown, wrong currency and below minimum are refused with clear reasons", async () => {
    const customer = await makeUser("rules");
    await fillCart(customer); // 40.00 USD

    const now = Date.now();
    const cases = [
        [await makeCoupon("EXPIRED", { startsAt: new Date(now - 10 * DAY), expiresAt: new Date(now - DAY) }), "COUPON_EXPIRED", /expired/],
        [await makeCoupon("INACTIVE", { isActive: false }), "COUPON_INACTIVE", /no longer active/],
        [await makeCoupon("LATER", { startsAt: new Date(now + DAY) }), "COUPON_NOT_STARTED", /not valid yet/],
        [await makeCoupon("RUPEE", { currency: "INR", discountType: "FIXED", discountValue: "200" }), "COUPON_CURRENCY", /only be used on orders in INR/],
        [await makeCoupon("MIN", { minimumOrderAmount: "50" }), "COUPON_MINIMUM_NOT_MET", /minimum order of 50\.00 USD/],
        [{ code: codeFor("NOSUCH") }, "COUPON_NOT_FOUND", /not valid/],
    ];

    for (const [coupon, code, message] of cases) {
        const res = await call("POST", "/coupons/validate", customer, { couponCode: coupon.code });
        assert.equal(res.status, 422, coupon.code);
        assert.equal(res.body.details[0].field, "couponCode");
        assert.equal(res.body.details[0].code, code);
        assert.match(res.body.message, message);

        // The checkout page still loads, without the discount, and says why.
        const checkout = await call("GET", `/checkout?couponCode=${coupon.code}`, customer);
        assert.equal(checkout.status, 200);
        assert.equal(checkout.body.data.summary.discount, 0);
        assert.equal(checkout.body.data.coupon, null);
        assert.equal(checkout.body.data.couponError.code, code);

        await rejectsWith(place(customer, coupon.code), 422, code);
    }

    // Exactly at the minimum is enough.
    const min = cases[4][0];
    await fillCart(customer, { quantity: 3 }); // 60.00
    assert.equal((await call("POST", "/coupons/validate", customer, { couponCode: min.code })).status, 200);

    const badShape = await call("POST", "/coupons/validate", customer, { couponCode: "x" });
    assert.equal(badShape.status, 422);
    assert.equal((await call("POST", "/coupons/validate", customer, {})).status, 422);
    assert.equal(await prisma.order.count({ where: { userId: customer.id } }), 0, "no order was placed");
});

dbTest("checkout: an INR coupon applies to an INR cart", async () => {
    const coupon = await makeCoupon("SAVE200", { currency: "INR", discountType: "FIXED", discountValue: "200", minimumOrderAmount: "999" });
    const customer = await makeUser("inr");
    await fillCart(customer, { product: inr, quantity: 2 }); // 1000.00 INR

    const res = await call("POST", "/coupons/validate", customer, { couponCode: coupon.code });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.summary.currency, "INR");
    assert.equal(res.body.data.summary.total, 800);
});

// ---------------------------------------------------------------- orders

dbTest("order: the server re-validates and stores the discount, code and one use; an applied total mismatch stops it", async () => {
    const coupon = await makeCoupon("ORDER", { discountValue: "25" });
    const customer = await makeUser("order");
    await fillCart(customer);
    const stockBefore = await stockOf(usd);

    // The total shown without the coupon is no longer the total: refused before stock is touched.
    const stale = await call("POST", "/orders", customer, { addressId: customer.addressId, couponCode: coupon.code, expectedTotal: "40.00" });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.details[0].code, "PRICE_CHANGED");
    assert.equal(await usedCount(coupon), 0);
    assert.equal(await stockOf(usd), stockBefore);

    // A discount in the body is ignored entirely.
    const res = await call("POST", "/orders", customer, {
        addressId: customer.addressId, couponCode: coupon.code.toLowerCase(), expectedTotal: "30.00", discount: 40, total: 0,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data.discount, 10);
    assert.equal(res.body.data.total, 30);
    assert.equal(res.body.data.couponCode, coupon.code);

    const stored = await prisma.order.findUnique({ where: { id: res.body.data.id } });
    assert.equal(stored.couponId, coupon.id);
    assert.equal(stored.discount.toFixed(2), "10.00");
    assert.equal(await usedCount(coupon), 1);
    assert.equal(await stockOf(usd), stockBefore - 2);

    // The order's own pages show the code.
    const detail = await call("GET", `/orders/${res.body.data.id}`, customer);
    assert.equal(detail.body.data.couponCode, coupon.code);
});

dbTest("order: a coupon that stops applying between checkout and order is refused and nothing is reserved", async () => {
    const coupon = await makeCoupon("FLIP");
    const customer = await makeUser("flip");
    await fillCart(customer);
    const stockBefore = await stockOf(usd);

    await prisma.coupon.update({ where: { id: coupon.id }, data: { isActive: false } });
    const res = await call("POST", "/orders", customer, { addressId: customer.addressId, couponCode: coupon.code });
    assert.equal(res.status, 422);
    assert.equal(res.body.details[0].code, "COUPON_INACTIVE");
    assert.equal(await stockOf(usd), stockBefore);
    assert.equal(await prisma.cartItem.count({ where: { cart: { userId: customer.id } } }), 1, "cart kept");
});

dbTest("order: a failure after the coupon is claimed rolls back the use with the order and stock", async () => {
    const coupon = await makeCoupon("ROLLBACK", { usageLimit: 1 });
    const customer = await makeUser("rollback");
    await fillCart(customer);
    const stockBefore = await stockOf(usd);

    await assert.rejects(orders.createOrder(customer.id, { addressId: customer.addressId, couponCode: coupon.code }, {
        afterStep: (name) => { if (name === "stock") throw new Error("injected failure"); },
    }), /injected failure/);

    assert.equal(await usedCount(coupon), 0);
    assert.equal(await stockOf(usd), stockBefore);
    assert.equal(await prisma.order.count({ where: { userId: customer.id } }), 0);

    // The single use is still available.
    await place(customer, coupon.code);
    assert.equal(await usedCount(coupon), 1);
});

dbTest("order: the total usage limit is enforced", async () => {
    const coupon = await makeCoupon("LIMIT", { usageLimit: 2 });
    const users = [await makeUser("limit-a"), await makeUser("limit-b"), await makeUser("limit-c")];
    for (const user of users) await fillCart(user);

    await place(users[0], coupon.code);
    await place(users[1], coupon.code);
    await rejectsWith(place(users[2], coupon.code), 422, "COUPON_USAGE_LIMIT");
    assert.equal(await usedCount(coupon), 2);

    const res = await call("POST", "/coupons/validate", users[2], { couponCode: coupon.code });
    assert.equal(res.body.details[0].code, "COUPON_USAGE_LIMIT");
});

dbTest("order: the per-user limit is enforced and a cancelled order gives its use back", async () => {
    const coupon = await makeCoupon("PERUSER", { usageLimitPerUser: 1 });
    const customer = await makeUser("peruser");
    const other = await makeUser("peruser-other");

    await fillCart(customer);
    const first = await place(customer, coupon.code);

    await fillCart(customer);
    await rejectsWith(place(customer, coupon.code), 422, "COUPON_USER_LIMIT");
    const res = await call("POST", "/coupons/validate", customer, { couponCode: coupon.code });
    assert.match(res.body.message, /already used this coupon/);

    // Another customer is not affected.
    await fillCart(other);
    await place(other, coupon.code);
    assert.equal(await usedCount(coupon), 2);

    // Cancelling gives the use back, so the customer can use it again.
    const cancelled = await orders.cancelOrder(customer.id, first.id);
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(await usedCount(coupon), 1);
    const again = await place(customer, coupon.code);
    assert.equal(again.couponCode, coupon.code);
    assert.equal(await usedCount(coupon), 2);
});

dbTest("race: concurrent orders never take more uses than the total limit", async () => {
    const LIMIT = 3;
    const coupon = await makeCoupon("RACE", { usageLimit: LIMIT });
    const users = [];
    for (let i = 0; i < 8; i++) {
        const user = await makeUser(`race-${i}`);
        await fillCart(user);
        users.push(user);
    }
    const stockBefore = await stockOf(usd);

    const results = await Promise.allSettled(users.map((user) => place(user, coupon.code)));
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected");

    assert.equal(won.length, LIMIT, lost.map((r) => r.reason?.message).join("; "));
    for (const { reason } of lost) {
        // The limit, or (under heavy lock contention) a retryable conflict; never a 500.
        assert.ok([409, 422].includes(reason.statusCode), reason.message);
    }
    assert.equal(await usedCount(coupon), LIMIT);
    assert.equal(await prisma.order.count({ where: { couponId: coupon.id } }), LIMIT);
    assert.equal(await stockOf(usd), stockBefore - 2 * LIMIT, "only the winners took stock");
});

dbTest("race: different customers using a coupon with both limits at once all succeed (no deadlock)", async () => {
    const coupon = await makeCoupon("RACEBOTH", { usageLimit: 50, usageLimitPerUser: 1 });
    const users = [];
    for (let i = 0; i < 8; i++) {
        const user = await makeUser(`raceboth-${i}`);
        await fillCart(user);
        users.push(user);
    }

    const results = await Promise.allSettled(users.map((user) => place(user, coupon.code)));
    const failures = results.filter((r) => r.status === "rejected").map((r) => `${r.reason?.statusCode} ${r.reason?.message}`);

    assert.deepEqual(failures, [], "every customer is within both limits");
    assert.equal(await usedCount(coupon), users.length);
});

dbTest("race: one customer's concurrent orders never exceed the per-user limit", async () => {
    const coupon = await makeCoupon("RACEUSER", { usageLimitPerUser: 1 });
    const customer = await makeUser("race-user");
    await fillCart(customer, { quantity: 1 });

    const results = await Promise.allSettled([1, 2, 3].map(() => place(customer, coupon.code)));
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await usedCount(coupon), 1);
});

// ---------------------------------------------------------------- online payment lifecycle

dbTest("payment: an unpaid online order holds its use; a failed payment keeps it; expiry gives it back", async () => {
    const coupon = await makeCoupon("ONLINE", { usageLimit: 1 });
    const customer = await makeUser("online");
    const other = await makeUser("online-other");
    await fillCart(customer);

    const order = await place(customer, coupon.code, { paymentMethod: "RAZORPAY" });
    assert.equal(order.paymentStatus, "UNPAID");
    assert.equal(order.total, 36);
    assert.equal(await usedCount(coupon), 1, "held while the reservation lasts");

    // A failed attempt leaves the order payable, so the use stays held.
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "FAILED" } });
    await fillCart(other);
    await rejectsWith(place(other, coupon.code), 422, "COUPON_USAGE_LIMIT");

    // The reservation ends unpaid: the order is cancelled and the use returned.
    const deadline = new Date(Date.now() - 1000);
    await prisma.order.update({ where: { id: order.id }, data: { reservationExpiresAt: deadline } });
    assert.equal(await orders.expireOrder(order.id, new Date()), true);
    assert.equal(await usedCount(coupon), 0);
    assert.equal(await orders.expireOrder(order.id, new Date()), false, "a repeat changes nothing");
    assert.equal(await usedCount(coupon), 0, "released once");

    // Now someone else can use it.
    await place(other, coupon.code);
    assert.equal(await usedCount(coupon), 1);
});

dbTest("payment: a late payment that reinstates an expired order takes its use again (even past the limit)", async () => {
    const coupon = await makeCoupon("LATE", { usageLimit: 1 });
    const customer = await makeUser("late");
    await fillCart(customer);

    const order = await place(customer, coupon.code, { paymentMethod: "RAZORPAY" });
    const razorpayOrderId = `order_CPN${RUN}${++sequence}`;
    await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId, reservationExpiresAt: new Date(Date.now() - 1000) } });
    assert.equal(await orders.expireOrder(order.id, new Date()), true);
    assert.equal(await usedCount(coupon), 0);

    // Meanwhile another customer takes the freed use.
    const other = await makeUser("late-other");
    await fillCart(other);
    await place(other, coupon.code);
    assert.equal(await usedCount(coupon), 1);

    // The customer paid the discounted total before the expiry was noticed.
    const payment = { id: `pay_CPN${RUN}${++sequence}`, order_id: razorpayOrderId, amount: 3600, currency: "USD", status: "captured" };
    const outcome = await orders.reinstateExpiredOrder(await prisma.order.findUnique({ where: { id: order.id } }), payment);
    assert.equal(outcome, "PAID");

    const stored = await prisma.order.findUnique({ where: { id: order.id } });
    assert.equal(stored.paymentStatus, "PAID");
    assert.equal(stored.couponId, coupon.id);
    assert.equal(await usedCount(coupon), 2, "the paid order holds its use again, past the limit of 1");

    // An over-used coupon can still be edited and switched off by an admin;
    // only setting the limit itself below the uses held is refused.
    const off = await call("POST", `/admin/coupons/${coupon.id}/deactivate`, admin);
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.equal(off.body.data.isActive, false);
    assert.equal((await call("PATCH", `/admin/coupons/${coupon.id}`, admin, { description: "Late" })).status, 200);
    assert.equal((await call("PATCH", `/admin/coupons/${coupon.id}`, admin, { usageLimit: 1 })).status, 422);
    assert.equal((await call("PATCH", `/admin/coupons/${coupon.id}`, admin, { usageLimit: 2 })).status, 200);
});

dbTest("payment: a coupon cannot bring an online order to zero; Cash on Delivery is still allowed", async () => {
    const coupon = await makeCoupon("FREE", { discountType: "FIXED", discountValue: "100" });
    const customer = await makeUser("free");
    await fillCart(customer);
    const stockBefore = await stockOf(usd);

    await rejectsWith(place(customer, coupon.code, { paymentMethod: "RAZORPAY" }), 422, "NOTHING_TO_PAY");
    assert.equal(await usedCount(coupon), 0);
    assert.equal(await stockOf(usd), stockBefore);

    const cod = await place(customer, coupon.code);
    assert.equal(cod.total, 0);
    assert.equal(cod.discount, 40);
});

// ---------------------------------------------------------------- abuse

dbTest("security: trying codes through checkout shares the per-user coupon attempt limit", async () => {
    const guesser = await makeUser("guesser");
    const bystander = await makeUser("bystander");
    await fillCart(guesser);

    let limited = 0;
    for (let i = 0; i < 61; i++) {
        const res = await call("GET", `/checkout?couponCode=GUESS${i}X`, guesser);
        if (res.status === 429) limited++;
    }
    assert.ok(limited >= 1, "the 61st guess is refused");
    assert.equal((await call("POST", "/coupons/validate", guesser, { couponCode: "ANOTHER" })).status, 429, "same budget as validate");

    // Plain checkout loads (no code) and other customers are unaffected.
    assert.equal((await call("GET", "/checkout", guesser)).status, 200);
    assert.equal((await call("GET", "/checkout?couponCode=SOMECODE", bystander)).status, 200);
});
