// Razorpay online payment: initiation, signature and payment verification,
// idempotency, mismatches, ownership, and the rule that unpaid online orders
// cannot enter fulfilment while COD orders still can.
//
// Razorpay itself is never called: the service tests swap in a fake gateway
// (setPaymentGateway), and the HTTP tests only use paths that are refused
// before any gateway call. The keys below are fake; the secret only signs the
// fake gateway's responses.
//
// Fixtures: three users (two customers, one admin) and item-less orders (no
// stock), all created by this run and deleted in after() by id, in the test
// database named by TEST_DATABASE_URL (see testDatabase.js); unset, these
// tests are skipped and nothing connects.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { signAccessToken } from "../utils/jwt.js";
import { startServer } from "./helpers.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

const RUN = crypto.randomBytes(4).toString("hex");
const KEY_ID = "rzp_test_PaymentsSuite";
const KEY_SECRET = `fake-secret-${crypto.randomBytes(12).toString("hex")}`;

// Read at call time by paymentService, and inherited by the spawned server.
process.env.RAZORPAY_KEY_ID = KEY_ID;
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;

// Database modules load only after the switch to the test database.
const { guard, skip, prisma } = await openTestDatabase();
const payments = guard.ok ? await import("../services/paymentService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const created = { users: [], orders: [] };
let server, alice, bob, admin, sequence = 0;

// ------------------------------------------------------------ fake Razorpay

// Gateway ids in Razorpay's formats; the payments this "gateway" knows about.
const gatewayOrders = [];
const gatewayPayments = new Map();
const nextId = (prefix) => `${prefix}_${RUN}${String(++sequence).padStart(4, "0")}`;

// Calls made, and a switch to make Razorpay unreachable.
const gateway = { calls: 0, down: false };

const fakeGateway = {
    async createOrder(params) {
        const order = { id: nextId("order"), amount: params.amount, currency: params.currency, receipt: params.receipt, status: "created" };
        gatewayOrders.push(order);
        return order;
    },
    async fetchPayment(id) {
        const payment = gatewayPayments.get(id);
        if (!payment) throw { statusCode: 400, error: { code: "BAD_REQUEST_ERROR" } };
        return payment;
    },
    async fetchOrderPayments(orderId) {
        gateway.calls += 1;
        if (gateway.down) throw { statusCode: 503, error: { code: "SERVER_ERROR" } };
        // Razorpay's collection shape (the server checks count against items).
        const items = [...gatewayPayments.values()].filter((p) => p.order_id === orderId);
        return { entity: "collection", count: items.length, items };
    },
};

// The refund-required log lines written while fn runs, parsed.
const REFUND_LOG = "Razorpay refund required ";
async function refundLogs(fn) {
    const lines = [];
    const original = console.error;
    console.error = (...args) => lines.push(args.join(" "));
    try {
        await fn();
    } catch {
        // The caller asserts the outcome separately.
    } finally {
        console.error = original;
    }
    return lines.filter((line) => line.startsWith(REFUND_LOG)).map((line) => {
        assert.ok(!line.includes(KEY_SECRET), "no secret in the log");
        return JSON.parse(line.slice(REFUND_LOG.length));
    });
}

// A payment as Razorpay would report it (40.00 USD = 4000 cents by default).
function gatewayPayment(razorpayOrderId, overrides = {}) {
    const payment = { id: nextId("pay"), entity: "payment", order_id: razorpayOrderId, amount: 4000, currency: "USD", status: "captured", ...overrides };
    gatewayPayments.set(payment.id, payment);
    return payment;
}

const sign = (razorpayOrderId, razorpayPaymentId, secret = KEY_SECRET) =>
    crypto.createHmac("sha256", secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");

const checkoutResult = (order, payment) => ({
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId: payment.id,
    razorpaySignature: sign(order.razorpayOrderId, payment.id),
});

// ------------------------------------------------------------ fixtures

async function makeUser(label, role = "CUSTOMER") {
    const user = await prisma.user.create({
        data: { email: `payments-${label}-${RUN}@example.test`, passwordHash: "not-a-login", firstName: "Pay", lastName: label, role },
    });
    created.users.push({ id: user.id, email: user.email });
    return { id: user.id, headers: { Authorization: `Bearer ${signAccessToken(user)}` } };
}

// An item-less order (no stock involved), online and unpaid unless overridden.
async function makeOrder(owner, overrides = {}) {
    const order = await prisma.order.create({
        data: {
            orderNumber: `PAY-${RUN}-${++sequence}`, userId: owner.id, status: "PENDING", paymentStatus: "UNPAID", paymentMethod: "RAZORPAY",
            subtotal: "40.00", total: "40.00", currency: "USD",
            shippingFirstName: "Pay", shippingLastName: "Buyer", shippingPhone: "5550000000", shippingEmail: "payments-buyer@example.test",
            shippingAddress: "1 Payment Way", shippingCity: "Austin", shippingState: "TX", shippingZipCode: "73301", shippingCountry: "United States",
            ...overrides,
        },
    });
    created.orders.push({ id: order.id, orderNumber: order.orderNumber });
    return order;
}

// An online order with a gateway order already created through initiatePayment.
async function initiatedOrder(owner = alice, overrides) {
    const order = await makeOrder(owner, overrides);
    const session = await payments.initiatePayment(owner.id, order.id);
    return { ...order, razorpayOrderId: session.razorpayOrderId };
}

const stored = (id) => prisma.order.findUnique({ where: { id } });

async function call(method, path, user, body) {
    const res = await fetch(`${server.url}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(user?.headers ?? {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
}

// Expects a rejected promise to be an ApiError with this status.
const rejectsWith = (promise, status) => assert.rejects(promise, (err) => {
    assert.equal(err.statusCode ?? err.status, status, `${err.message}`);
    return true;
});

before(async () => {
    if (!guard.ok) return;

    // Before any write: this process is on the test database.
    await assertOnTestDatabase(prisma);

    payments.setPaymentGateway(fakeGateway);

    alice = await makeUser("alice");
    bob = await makeUser("bob");
    admin = await makeUser("admin", "ADMIN");

    server = await startServer(testServerEnv(guard));

    // The server reads an order that exists only in this run (a GET).
    const probe = await makeOrder(alice, { paymentMethod: "COD" });
    const seen = await call("GET", `/orders/${probe.id}`, alice);
    assert.equal(seen.body?.data?.orderNumber, probe.orderNumber, "server is on the test database");
});

after(async () => {
    if (!guard.ok) return;

    try {
        await deleteInTestDatabase(prisma, async (tx) => {
            // Refund records reported for this run's orders (they reference the orders).
            await tx.unappliedPayment.deleteMany({ where: { orderId: { in: created.orders.map((o) => o.id) } } });
            expectDeleted("orders", await tx.order.deleteMany({
                where: { id: { in: created.orders.map((o) => o.id) }, orderNumber: { in: created.orders.map((o) => o.orderNumber) } },
            }), created.orders.length);
            expectDeleted("users", await tx.user.deleteMany({
                where: { id: { in: created.users.map((u) => u.id) }, email: { in: created.users.map((u) => u.email) } },
            }), created.users.length);
        });
    } finally {
        payments.setPaymentGateway?.(null);
        await server?.stop();
        await prisma.$disconnect();
    }
});

// ------------------------------------------------------------ helpers

dbTest("unit: amounts in minor units from the stored Decimal; signature check is exact", () => {
    assert.equal(payments.toMinorUnits("40.00", "USD"), 4000);
    assert.equal(payments.toMinorUnits("19.99", "INR"), 1999);
    assert.equal(payments.toMinorUnits("0.10", "USD"), 10);
    assert.throws(() => payments.toMinorUnits("10.00", "JPY"), /not available for JPY/);
    assert.throws(() => payments.toMinorUnits("0.00", "USD"), /cannot be paid online/);

    const signature = sign("order_A1", "pay_B2");
    assert.equal(payments.isValidSignature("order_A1", "pay_B2", signature, KEY_SECRET), true);
    assert.equal(payments.isValidSignature("order_A1", "pay_B2", signature.toUpperCase(), KEY_SECRET), true, "hex case does not matter");
    assert.equal(payments.isValidSignature("order_A1", "pay_B3", signature, KEY_SECRET), false, "other payment id");
    assert.equal(payments.isValidSignature("order_A2", "pay_B2", signature, KEY_SECRET), false, "other order id");
    assert.equal(payments.isValidSignature("order_A1", "pay_B2", sign("order_A1", "pay_B2", "other-secret"), KEY_SECRET), false, "other secret");
    for (const bad of ["", "abc", signature.slice(0, 63), `${signature}00`, "z".repeat(64), null, 42]) {
        assert.equal(payments.isValidSignature("order_A1", "pay_B2", bad, KEY_SECRET), false, String(bad));
    }
});

// ------------------------------------------------------------ initiation

dbTest("initiate: one gateway order for the stored total, reused on retry; only the public key id is returned", async () => {
    const order = await makeOrder(alice, { subtotal: "123.45", total: "123.45" });
    const before = gatewayOrders.length;

    const first = await payments.initiatePayment(alice.id, order.id);
    assert.equal(first.amount, 12345, "minor units of the stored total");
    assert.equal(first.currency, "USD");
    assert.equal(first.keyId, KEY_ID);
    assert.equal(first.orderNumber, order.orderNumber);
    assert.ok(!JSON.stringify(first).includes(KEY_SECRET), "the key secret never leaves the server");
    assert.equal(gatewayOrders.at(-1).amount, 12345);
    assert.equal(gatewayOrders.at(-1).receipt, order.orderNumber);
    assert.equal((await stored(order.id)).razorpayOrderId, first.razorpayOrderId);

    const again = await payments.initiatePayment(alice.id, order.id);
    assert.equal(again.razorpayOrderId, first.razorpayOrderId, "retry reuses the gateway order");
    assert.equal(gatewayOrders.length, before + 1, "no second gateway order");
});

dbTest("initiate: refused for COD, paid, cancelled and other customers' orders", async () => {
    await rejectsWith(payments.initiatePayment(alice.id, (await makeOrder(alice, { paymentMethod: "COD" })).id), 409);
    await rejectsWith(payments.initiatePayment(alice.id, (await makeOrder(alice, { paymentStatus: "PAID" })).id), 409);
    await rejectsWith(payments.initiatePayment(alice.id, (await makeOrder(alice, { status: "CANCELLED" })).id), 409);
    await rejectsWith(payments.initiatePayment(alice.id, (await makeOrder(alice, { status: "CONFIRMED" })).id), 409);
    await rejectsWith(payments.initiatePayment(bob.id, (await makeOrder(alice)).id), 404);
});

// ------------------------------------------------------------ verification

dbTest("verify: a captured payment with a valid signature marks the order PAID, nothing else changes", async () => {
    const order = await initiatedOrder();
    const payment = gatewayPayment(order.razorpayOrderId);

    const { state, order: response } = await payments.verifyPayment(alice.id, order.id, checkoutResult(order, payment));

    assert.equal(state, "PAID");
    assert.equal(response.paymentStatus, "PAID");
    assert.equal(response.payable, false);
    const row = await stored(order.id);
    assert.equal(row.paymentStatus, "PAID");
    assert.equal(row.razorpayPaymentId, payment.id);
    assert.ok(row.paidAt instanceof Date);
    assert.equal(row.status, "PENDING", "payment does not move fulfilment");
    assert.equal(row.total.toFixed(2), "40.00");
});

dbTest("verify: repeated and concurrent verifications settle once and agree", async () => {
    const order = await initiatedOrder();
    const payment = gatewayPayment(order.razorpayOrderId);
    const body = checkoutResult(order, payment);

    const results = await Promise.all(Array.from({ length: 5 }, () => payments.verifyPayment(alice.id, order.id, body)));
    assert.deepEqual(results.map((r) => r.state), ["PAID", "PAID", "PAID", "PAID", "PAID"]);
    const paidAt = (await stored(order.id)).paidAt;

    const again = await payments.verifyPayment(alice.id, order.id, body);
    assert.equal(again.state, "PAID");
    assert.deepEqual((await stored(order.id)).paidAt, paidAt, "a repeat changes nothing");

    // A different payment for an already paid order is refused.
    const extra = gatewayPayment(order.razorpayOrderId);
    await rejectsWith(payments.verifyPayment(alice.id, order.id, checkoutResult(order, extra)), 409);
    assert.equal((await stored(order.id)).razorpayPaymentId, payment.id);
});

dbTest("verify: invalid or tampered signatures are refused and change nothing", async () => {
    const order = await initiatedOrder();
    const payment = gatewayPayment(order.razorpayOrderId);

    const tampered = [
        { ...checkoutResult(order, payment), razorpaySignature: "0".repeat(64) },
        { ...checkoutResult(order, payment), razorpaySignature: sign(order.razorpayOrderId, payment.id, "not-the-secret") },
        { ...checkoutResult(order, payment), razorpayPaymentId: gatewayPayment(order.razorpayOrderId).id },
    ];
    for (const body of tampered) await rejectsWith(payments.verifyPayment(alice.id, order.id, body), 400);

    const row = await stored(order.id);
    assert.equal(row.paymentStatus, "UNPAID");
    assert.equal(row.razorpayPaymentId, null);
});

dbTest("verify: mismatched gateway order, amount or currency is refused", async () => {
    const order = await initiatedOrder();
    const other = await initiatedOrder();

    // Ids (validly signed) from another order's checkout.
    const foreign = gatewayPayment(other.razorpayOrderId);
    await rejectsWith(payments.verifyPayment(alice.id, order.id, checkoutResult(other, foreign)), 409);

    // Signed for this gateway order, but Razorpay reports the payment under another one.
    const moved = gatewayPayment(other.razorpayOrderId);
    await rejectsWith(payments.verifyPayment(alice.id, order.id, { razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: moved.id, razorpaySignature: sign(order.razorpayOrderId, moved.id) }), 409);

    for (const overrides of [{ amount: 3999 }, { amount: 400000 }, { currency: "INR" }]) {
        const wrong = gatewayPayment(order.razorpayOrderId, overrides);
        await rejectsWith(payments.verifyPayment(alice.id, order.id, checkoutResult(order, wrong)), 409);
    }

    assert.equal((await stored(order.id)).paymentStatus, "UNPAID");
});

// ------------------------------------------------------------ INR orders

// An order stored in INR (as order creation persists for an INR cart): the
// gateway gets that stored amount in paise and "INR", and only a payment of
// exactly that amount and currency pays it.
const inrOrder = { subtotal: "1497.00", total: "1497.00", currency: "INR" };

dbTest("INR: the gateway order is the stored INR total in paise, in INR", async () => {
    const order = await makeOrder(alice, inrOrder);

    const session = await payments.initiatePayment(alice.id, order.id);
    assert.equal(session.amount, 149700, "1497.00 rupees = 149700 paise");
    assert.equal(session.currency, "INR");
    assert.deepEqual([gatewayOrders.at(-1).amount, gatewayOrders.at(-1).currency], [149700, "INR"]);

    // The stored order is untouched by initiation.
    const row = await stored(order.id);
    assert.deepEqual([row.currency, row.total.toFixed(2)], ["INR", "1497.00"]);
});

dbTest("INR: a captured payment of exactly the stored paise and INR pays the order", async () => {
    const order = await initiatedOrder(alice, inrOrder);
    const payment = gatewayPayment(order.razorpayOrderId, { amount: 149700, currency: "INR" });

    const result = await payments.verifyPayment(alice.id, order.id, checkoutResult(order, payment));
    assert.equal(result.state, "PAID");
    assert.equal(result.order.currency, "INR");
    assert.equal((await stored(order.id)).razorpayPaymentId, payment.id);
});

dbTest("INR: the same number in another currency, or rupees sent as paise, does not pay the order", async () => {
    const order = await initiatedOrder(alice, inrOrder);

    for (const overrides of [{ amount: 149700, currency: "USD" }, { amount: 1497, currency: "INR" }, { amount: 149699, currency: "INR" }]) {
        const wrong = gatewayPayment(order.razorpayOrderId, overrides);
        await rejectsWith(payments.verifyPayment(alice.id, order.id, checkoutResult(order, wrong)), 409);
    }

    assert.equal((await stored(order.id)).paymentStatus, "UNPAID");
});

dbTest("legacy: a stored USD order is still charged in USD cents, never as INR", async () => {
    const order = await makeOrder(alice, { subtotal: "40.00", total: "40.00" });

    const session = await payments.initiatePayment(alice.id, order.id);
    assert.deepEqual([session.amount, session.currency], [4000, "USD"]);
    assert.equal((await stored(order.id)).currency, "USD");
});

dbTest("verify: authorized or failed payments do not mark the order paid", async () => {
    const order = await initiatedOrder();

    const pending = gatewayPayment(order.razorpayOrderId, { status: "authorized" });
    assert.equal((await payments.verifyPayment(alice.id, order.id, checkoutResult(order, pending))).state, "PROCESSING");

    const failed = gatewayPayment(order.razorpayOrderId, { status: "failed" });
    const result = await payments.verifyPayment(alice.id, order.id, checkoutResult(order, failed));
    assert.equal(result.state, "FAILED");
    assert.equal(result.order.payable, true, "the customer can try again");

    assert.equal((await stored(order.id)).paymentStatus, "UNPAID");
});

dbTest("verify: other customers' orders, COD orders and cancelled orders are refused", async () => {
    const order = await initiatedOrder();
    const payment = gatewayPayment(order.razorpayOrderId);
    await rejectsWith(payments.verifyPayment(bob.id, order.id, checkoutResult(order, payment)), 404);

    const cod = await makeOrder(alice, { paymentMethod: "COD" });
    await rejectsWith(payments.verifyPayment(alice.id, cod.id, checkoutResult(order, payment)), 409);

    // Cancelled after the gateway order was created, then a captured payment arrives.
    const cancelled = await initiatedOrder();
    await prisma.order.update({ where: { id: cancelled.id }, data: { status: "CANCELLED" } });
    const late = gatewayPayment(cancelled.razorpayOrderId);
    await rejectsWith(payments.verifyPayment(alice.id, cancelled.id, checkoutResult(cancelled, late)), 409);
    const row = await stored(cancelled.id);
    assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["CANCELLED", "UNPAID", null]);

    assert.equal((await stored(order.id)).paymentStatus, "UNPAID", "bob's attempt changed nothing");
});

dbTest("refresh: settles from Razorpay's own records without browser data", async () => {
    const order = await initiatedOrder();
    assert.equal((await payments.refreshPayment(alice.id, order.id)).state, "UNPAID");

    gatewayPayment(order.razorpayOrderId, { status: "failed" });
    assert.equal((await payments.refreshPayment(alice.id, order.id)).state, "FAILED");

    const captured = gatewayPayment(order.razorpayOrderId);
    const result = await payments.refreshPayment(alice.id, order.id);
    assert.equal(result.state, "PAID");
    assert.equal((await stored(order.id)).razorpayPaymentId, captured.id);

    // Not yet initiated: nothing to check.
    assert.equal((await payments.refreshPayment(alice.id, (await makeOrder(alice)).id)).state, "UNPAID");
    await rejectsWith(payments.refreshPayment(bob.id, order.id), 404);
});

// ------------------------------------------------------------ HTTP

dbTest("http: payment endpoints need a signed-in owner and validate the body", async () => {
    const order = await makeOrder(alice);
    const body = { razorpayOrderId: "order_X1", razorpayPaymentId: "pay_Y1", razorpaySignature: "a".repeat(64) };

    for (const path of [`/orders/${order.id}/payment`, `/orders/${order.id}/payment/verify`, `/orders/${order.id}/payment/refresh`]) {
        assert.equal((await call("POST", path, null, body)).status, 401, `${path} signed out`);
        assert.equal((await call("POST", path, bob, body)).status, 404, `${path} another customer`);
    }

    for (const bad of [{}, { ...body, razorpaySignature: "xyz" }, { ...body, razorpayOrderId: "x" }, { ...body, razorpayPaymentId: 7 }]) {
        assert.equal((await call("POST", `/orders/${order.id}/payment/verify`, alice, bad)).status, 422, JSON.stringify(bad));
    }

    const cod = await makeOrder(alice, { paymentMethod: "COD" });
    assert.equal((await call("POST", `/orders/${cod.id}/payment`, alice)).status, 409, "COD orders are not paid online");

    assert.equal((await call("POST", "/orders", alice, { addressId: 1, paymentMethod: "BITCOIN" })).status, 422);
});

dbTest("http: a forged signature is refused before Razorpay is asked, and the order stays unpaid", async () => {
    const order = await makeOrder(alice, { razorpayOrderId: nextId("order") });
    const forged = { razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: nextId("pay"), razorpaySignature: sign(order.razorpayOrderId, "pay_other") };

    const res = await call("POST", `/orders/${order.id}/payment/verify`, alice, forged);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Payment verification failed");
    assert.equal((await stored(order.id)).paymentStatus, "UNPAID");

    const mismatch = await call("POST", `/orders/${order.id}/payment/verify`, alice, { ...forged, razorpayOrderId: nextId("order") });
    assert.equal(mismatch.status, 409, "ids from another gateway order");
});

dbTest("http: order responses and checkout expose payment fields; the secret never appears", async () => {
    const order = await makeOrder(alice);
    const detail = await call("GET", `/orders/${order.id}`, alice);
    assert.equal(detail.body.data.paymentMethod, "RAZORPAY");
    assert.equal(detail.body.data.payable, true);
    assert.equal(detail.body.data.paidAt, null);

    const checkout = await call("GET", "/checkout", alice);
    assert.deepEqual(checkout.body.data.paymentMethods, ["COD", "RAZORPAY"]);

    for (const res of [detail, checkout]) assert.ok(!JSON.stringify(res.body).includes(KEY_SECRET));
    assert.ok(!server.output().includes(KEY_SECRET), "the secret is never logged");
});

dbTest("http: without Razorpay keys only COD is offered and online orders are refused before anything is reserved", async () => {
    const plain = await startServer({ ...testServerEnv(guard), RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "" });
    try {
        const checkout = await (await fetch(`${plain.url}/checkout`, { headers: alice.headers })).json();
        assert.deepEqual(checkout.data.paymentMethods, ["COD"]);

        const res = await fetch(`${plain.url}/orders`, {
            method: "POST", headers: { "Content-Type": "application/json", ...alice.headers }, body: JSON.stringify({ addressId: 1, paymentMethod: "RAZORPAY" }),
        });
        assert.equal(res.status, 503);
    } finally {
        await plain.stop();
    }
});

// ------------------------------------------------------------ fulfilment gating

dbTest("fulfilment: unpaid online orders cannot be confirmed; paid online and unpaid COD orders can", async () => {
    const online = await initiatedOrder();

    const detail = await call("GET", `/admin/orders/${online.id}`, admin);
    assert.equal(detail.body.data.awaitingPayment, true);
    assert.equal(detail.body.data.nextStatus, null);

    const blocked = await call("PATCH", `/admin/orders/${online.id}/status`, admin, { status: "CONFIRMED" });
    assert.equal(blocked.status, 409);
    assert.match(blocked.body.message, /awaiting online payment/);
    assert.equal((await stored(online.id)).status, "PENDING");

    // Paid through verification: fulfilment proceeds as usual.
    const payment = gatewayPayment(online.razorpayOrderId);
    await payments.verifyPayment(alice.id, online.id, checkoutResult(online, payment));
    for (const step of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]) {
        assert.equal((await call("PATCH", `/admin/orders/${online.id}/status`, admin, { status: step })).status, 200, step);
    }
    assert.equal((await stored(online.id)).paymentStatus, "PAID");

    // COD keeps the existing behaviour: fulfilled while unpaid.
    const cod = await makeOrder(alice, { paymentMethod: "COD" });
    const codDetail = await call("GET", `/admin/orders/${cod.id}`, admin);
    assert.equal(codDetail.body.data.awaitingPayment, false);
    assert.equal(codDetail.body.data.nextStatus, "CONFIRMED");
    assert.equal((await call("PATCH", `/admin/orders/${cod.id}/status`, admin, { status: "CONFIRMED" })).status, 200);
});

// ------------------------------------------------------------ refund-required reporting

dbTest("refund log: an extra captured payment on a paid order is refused and reported, sanitized", async () => {
    const order = await initiatedOrder();
    const first = gatewayPayment(order.razorpayOrderId);
    await payments.verifyPayment(alice.id, order.id, checkoutResult(order, first));

    const extra = gatewayPayment(order.razorpayOrderId);
    const body = checkoutResult(order, extra);
    await rejectsWith(payments.verifyPayment(alice.id, order.id, body), 409);

    const logs = await refundLogs(() => payments.verifyPayment(alice.id, order.id, body));
    assert.deepEqual(logs, [{
        event: "razorpay_refund_required", reason: "order_already_paid", orderNumber: order.orderNumber,
        razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: extra.id, paymentStatus: "captured",
    }], "only the order number, gateway ids and status");
    assert.equal((await stored(order.id)).razorpayPaymentId, first.id, "the first payment still stands");
});

dbTest("refund log: refresh settles the first of two captured payments and reports the other, also once paid", async () => {
    const order = await initiatedOrder();
    const first = gatewayPayment(order.razorpayOrderId);
    const second = gatewayPayment(order.razorpayOrderId);

    let result;
    const logs = await refundLogs(async () => { result = await payments.refreshPayment(alice.id, order.id); });
    assert.equal(result.state, "PAID");
    assert.equal((await stored(order.id)).razorpayPaymentId, first.id);
    assert.deepEqual(logs.map((l) => [l.reason, l.razorpayPaymentId]), [["duplicate_capture", second.id]]);

    // A later status check of the paid order still reports the extra payment.
    const again = await refundLogs(() => payments.refreshPayment(alice.id, order.id));
    assert.deepEqual(again.map((l) => [l.reason, l.razorpayPaymentId]), [["duplicate_capture", second.id]]);
});

dbTest("refund log: money for a cancelled order is reported, whether captured or still authorized", async () => {
    const order = await initiatedOrder();
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });

    const authorized = gatewayPayment(order.razorpayOrderId, { status: "authorized" });
    const onRefresh = await refundLogs(() => payments.refreshPayment(alice.id, order.id));
    assert.deepEqual(onRefresh.map((l) => [l.reason, l.razorpayPaymentId, l.paymentStatus]), [["order_not_payable", authorized.id, "authorized"]]);

    const captured = gatewayPayment(order.razorpayOrderId);
    await rejectsWith(payments.verifyPayment(alice.id, order.id, checkoutResult(order, captured)), 409);
    const onVerify = await refundLogs(() => payments.verifyPayment(alice.id, order.id, checkoutResult(order, captured)));
    assert.deepEqual(onVerify.map((l) => [l.reason, l.razorpayPaymentId]), [["order_not_payable", captured.id]]);

    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["CANCELLED", "UNPAID", null]);
});

// ------------------------------------------------------------ cancellation

dbTest("cancel: online orders are checked with Razorpay first; uncertain or paid ones are not cancelled", async () => {
    const state = async (id) => {
        const row = await stored(id);
        return [row.status, row.paymentStatus];
    };

    // Never initiated: no payment can exist, so no gateway call is needed.
    const fresh = await makeOrder(alice);
    let calls = gateway.calls;
    assert.equal((await payments.cancelOrderAfterPaymentCheck(alice.id, fresh.id)).status, "CANCELLED");
    assert.equal(gateway.calls, calls, "no gateway call");

    // Only a failed attempt: safe to cancel.
    const failed = await initiatedOrder();
    gatewayPayment(failed.razorpayOrderId, { status: "failed" });
    assert.equal((await payments.cancelOrderAfterPaymentCheck(alice.id, failed.id)).status, "CANCELLED");

    // Captured but not yet verified: the order is paid instead of cancelled.
    const paid = await initiatedOrder();
    const payment = gatewayPayment(paid.razorpayOrderId);
    await rejectsWith(payments.cancelOrderAfterPaymentCheck(alice.id, paid.id), 409);
    assert.deepEqual(await state(paid.id), ["PENDING", "PAID"]);
    assert.equal((await stored(paid.id)).razorpayPaymentId, payment.id);

    // Authorized, not captured yet: kept as is for a later retry.
    const processing = await initiatedOrder();
    gatewayPayment(processing.razorpayOrderId, { status: "authorized" });
    await rejectsWith(payments.cancelOrderAfterPaymentCheck(alice.id, processing.id), 409);
    assert.deepEqual(await state(processing.id), ["PENDING", "UNPAID"]);

    // Razorpay unreachable: unknown, so kept as is; the retry works once it is back.
    const unknown = await initiatedOrder();
    gateway.down = true;
    try {
        await assert.rejects(payments.cancelOrderAfterPaymentCheck(alice.id, unknown.id), (err) => {
            assert.equal(err.statusCode, 409);
            assert.match(err.message, /couldn't confirm this order's payment status/);
            return true;
        });
    } finally {
        gateway.down = false;
    }
    assert.deepEqual(await state(unknown.id), ["PENDING", "UNPAID"]);
    assert.equal((await payments.cancelOrderAfterPaymentCheck(alice.id, unknown.id)).status, "CANCELLED");

    // Ownership is checked before anything else.
    await rejectsWith(payments.cancelOrderAfterPaymentCheck(bob.id, (await initiatedOrder()).id), 404);
});

dbTest("cancel: COD orders cancel exactly as before, without asking Razorpay", async () => {
    const cod = await makeOrder(alice, { paymentMethod: "COD" });
    const calls = gateway.calls;

    const cancelled = await payments.cancelOrderAfterPaymentCheck(alice.id, cod.id);
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(gateway.calls, calls, "no gateway call");

    await rejectsWith(payments.cancelOrderAfterPaymentCheck(alice.id, cod.id), 409);

    // Over HTTP too (the server's real gateway is never reached for COD).
    const viaHttp = await makeOrder(alice, { paymentMethod: "COD" });
    const res = await call("POST", `/orders/${viaHttp.id}/cancel`, alice);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "CANCELLED");
});
