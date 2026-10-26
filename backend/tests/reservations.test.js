// Online-order reservations (30 minutes), the expiry worker, late payments,
// and the Razorpay webhook: signatures, idempotency, races and refunds owed.
//
// Razorpay is never called. The payment service uses a fake gateway
// (setPaymentGateway) in this process; the spawned server only receives
// webhooks, which make no gateway call, and its keys are fake.
//
// Time: every fixture's reservation deadline is moved into 2001, and the
// worker is run with a clock in 2001, so a sweep can only ever reach this
// run's orders (any other order's deadline is years later).
//
// Fixtures: a category, two products, three users and their orders, all
// created by this run and deleted in after(), in the test database named by
// TEST_DATABASE_URL (see testDatabase.js); unset, these tests are skipped.
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
const KEY_SECRET = `fake-key-secret-${crypto.randomBytes(12).toString("hex")}`;
const WEBHOOK_SECRET = `fake-webhook-secret-${crypto.randomBytes(12).toString("hex")}`;

// Read at call time by the services, and inherited by the spawned server.
process.env.RAZORPAY_KEY_ID = "rzp_test_ReservationsSuite";
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

const { guard, skip, prisma } = await openTestDatabase();
const orders = guard.ok ? await import("../services/orderService.js") : {};
const payments = guard.ok ? await import("../services/paymentService.js") : {};
const reservations = guard.ok ? await import("../services/reservationService.js") : {};
const webhooks = guard.ok ? await import("../services/razorpayWebhookService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const created = { users: [], products: [], categories: [], gatewayOrders: [], eventKeys: [] };
let server, alice, bob, admin, variants, sequence = 0;

// ------------------------------------------------------------ clock

const DAY = 24 * 60 * 60 * 1000;
// A day in 2001 per test, so one test's sweep never reaches another's orders.
const epoch = (day) => new Date(Date.UTC(2001, 0, 1) + day * DAY);
const plus = (date, ms) => new Date(date.getTime() + ms);

// ------------------------------------------------------------ fake Razorpay

const gatewayPayments = new Map();
// down: Razorpay unreachable. respond(orderId, response): replaces a payments
// list (malformed or partial responses). listFails(page) -> true: that page of
// GET /payments fails. listRespond(page, response): replaces such a page.
const gateway = { down: false, fetches: 0, respond: null, listFails: null, listRespond: null, listCalls: 0 };
const nextId = (prefix) => `${prefix}_${RUN}${String(++sequence).padStart(4, "0")}`;

const fakeGateway = {
    async createOrder(params) {
        const order = { id: nextId("order"), amount: params.amount, currency: params.currency, status: "created" };
        created.gatewayOrders.push(order.id);
        return order;
    },
    async fetchPayment(id) {
        const payment = gatewayPayments.get(id);
        if (!payment) throw { statusCode: 400, error: { code: "BAD_REQUEST_ERROR" } };
        return payment;
    },
    async fetchOrderPayments(orderId) {
        gateway.fetches += 1;
        if (gateway.down) throw { statusCode: 503, error: { code: "SERVER_ERROR" } };
        const items = [...gatewayPayments.values()].filter((p) => p.order_id === orderId);
        const response = { entity: "collection", count: items.length, items };
        return gateway.respond ? gateway.respond(orderId, response) : response;
    },
    // GET /payments: created_at within [from, to] (Unix seconds), newest first, count/skip.
    async listPayments({ from, to, count, skip }) {
        gateway.listCalls += 1;
        const page = Math.floor(skip / count);
        if (gateway.listFails?.(page)) throw { statusCode: 503, error: { code: "SERVER_ERROR" } };
        const all = [...gatewayPayments.values()]
            .filter((p) => p.created_at >= from && p.created_at <= to)
            .sort((a, b) => b.created_at - a.created_at || (a.id < b.id ? 1 : -1));
        const items = all.slice(skip, skip + count).map((p) => ({ ...p }));
        const response = { entity: "collection", count: items.length, items };
        return gateway.listRespond ? gateway.listRespond(page, response) : response;
    },
};

// 2 x 20.00 USD = 4000 cents, the total of every fixture order.
function gatewayPayment(razorpayOrderId, overrides = {}) {
    const payment = {
        id: nextId("pay"), entity: "payment", order_id: razorpayOrderId, amount: 4000, currency: "USD", status: "captured",
        created_at: Math.floor(Date.now() / 1000), ...overrides,
    };
    gatewayPayments.set(payment.id, payment);
    return payment;
}

const checkoutSignature = (orderId, paymentId) => crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

const verify = (user, order, payment) => payments.verifyPayment(user.id, order.id, {
    razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: payment.id, razorpaySignature: checkoutSignature(order.razorpayOrderId, payment.id),
});

// ------------------------------------------------------------ webhooks

function paymentEvent(event, payment) {
    return JSON.stringify({
        entity: "event", account_id: "acc_ReservationsSuite", event, contains: ["payment"],
        payload: { payment: { entity: { ...payment, entity: "payment", method: "card", captured: payment.status === "captured" } } },
        created_at: 1700000000,
    });
}

function refundEvent(refund) {
    return JSON.stringify({
        entity: "event", account_id: "acc_ReservationsSuite", event: "refund.processed", contains: ["refund", "payment"],
        payload: { refund: { entity: { entity: "refund", status: "processed", ...refund } } },
        created_at: 1700000000,
    });
}

const webhookSignature = (body, secret = WEBHOOK_SECRET) => crypto.createHmac("sha256", secret).update(body).digest("hex");

const newEventId = () => {
    const id = `evt_${RUN}${String(++sequence).padStart(4, "0")}`;
    created.eventKeys.push(id);
    return id;
};

// Delivers a webhook to the spawned server, as Razorpay would.
async function deliver(body, { eventId = newEventId(), signature = webhookSignature(body), headers = {} } = {}) {
    const res = await fetch(`${server.url}/webhooks/razorpay`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(signature !== null && { "X-Razorpay-Signature": signature }),
            ...(eventId !== null && { "X-Razorpay-Event-Id": eventId }),
            ...headers,
        },
        body,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
}

// The same, in this process (for failure injection).
const handle = (body, eventId = newEventId(), hooks) => webhooks.handleWebhook(Buffer.from(body), {
    "x-razorpay-signature": webhookSignature(body), "x-razorpay-event-id": eventId,
}, hooks);

// ------------------------------------------------------------ fixtures

async function makeUser(label, role = "CUSTOMER") {
    const user = await prisma.user.create({
        data: { email: `reservations-${label}-${RUN}@example.test`, passwordHash: "not-a-login", firstName: "Res", lastName: label, role },
    });
    created.users.push({ id: user.id, email: user.email });
    const address = role === "CUSTOMER" ? await prisma.address.create({
        data: {
            userId: user.id, firstName: "Res", lastName: label, phone: "5550000000", address: "1 Reserve Rd",
            city: "Austin", state: "TX", zipCode: "73301", country: "United States", isDefault: true,
        },
    }) : null;
    return { id: user.id, addressId: address?.id, headers: { Authorization: `Bearer ${signAccessToken(user)}` } };
}

const stockOf = async (variant) => (await prisma.productVariant.findUnique({ where: { id: variant.id }, select: { stock: true } })).stock;
const stored = (id) => prisma.order.findUnique({ where: { id } });
const unapplied = (orderId) => prisma.unappliedPayment.findMany({ where: { orderId }, orderBy: { id: "asc" } });

// Places a real order through createOrder (stock is taken), 2 of `variant`.
async function place(user, { variant = variants[0], paymentMethod = "RAZORPAY" } = {}) {
    const cart = await prisma.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    await prisma.cartItem.create({ data: { cartId: cart.id, variantId: variant.id, quantity: 2 } });
    return orders.createOrder(user.id, { addressId: user.addressId, paymentMethod });
}

// An online order with a gateway order (via initiatePayment), its deadline
// then moved to `deadline`.
async function initiated(user, deadline, options) {
    const order = await place(user, options);
    const { razorpayOrderId } = await payments.initiatePayment(user.id, order.id);
    if (deadline) await prisma.order.update({ where: { id: order.id }, data: { reservationExpiresAt: deadline } });
    return { ...order, razorpayOrderId };
}

const setDeadline = (id, deadline) => prisma.order.update({ where: { id }, data: { reservationExpiresAt: deadline } });

const rejectsWith = (promise, status, pattern) => assert.rejects(promise, (err) => {
    assert.equal(err.statusCode, status, err.message);
    if (pattern) assert.match(err.message, pattern);
    return true;
});

// Waits until another connection's statement has been blocked (on a row lock)
// for a second, so a race is really exercised (see auth.test.js).
async function waitForBlockedStatement(timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const [{ n }] = await prisma.$queryRaw`
            SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST
            WHERE DB = DATABASE() AND COMMAND IN ('Query', 'Execute') AND TIME >= 1 AND ID <> CONNECTION_ID()`;
        if (Number(n) > 0) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("the other operation never waited for the open transaction, so the race was not exercised");
}

before(async () => {
    if (!guard.ok) return;

    await assertOnTestDatabase(prisma);

    payments.setPaymentGateway(fakeGateway);

    const slug = `reservations-${RUN}`;
    const category = await prisma.category.create({ data: { name: `Reservations ${RUN}`, slug } });
    created.categories.push({ id: category.id, slug });

    variants = [];
    for (const suffix of ["a", "b"]) {
        const product = await prisma.product.create({
            data: {
                categoryId: category.id, name: `Reservations ${RUN} ${suffix}`, slug: `reservations-${RUN}-${suffix}`,
                price: "20.00", currency: "USD", isActive: true,
                variants: { create: [{ sku: `RES-${RUN}-${suffix}`.toUpperCase(), size: "M", color: "Black", stock: 200 }] },
            },
            include: { variants: true },
        });
        created.products.push({ id: product.id, slug: product.slug });
        variants.push({ id: product.variants[0].id, productId: product.id });
    }

    alice = await makeUser("alice");
    bob = await makeUser("bob");
    admin = await makeUser("admin", "ADMIN");

    server = await startServer(testServerEnv(guard));

    const probe = await fetch(`${server.url}/products/${variants[0].productId}`).then((r) => r.json());
    assert.equal(probe?.data?.name, `Reservations ${RUN} a`, "server is on the test database");
});

after(async () => {
    if (!guard.ok) return;

    try {
        const userIds = created.users.map((u) => u.id);
        await deleteInTestDatabase(prisma, async (tx) => {
            await tx.razorpayWebhookEvent.deleteMany({
                where: { OR: [{ eventKey: { in: created.eventKeys } }, { razorpayOrderId: { in: created.gatewayOrders } }] },
            });
            await tx.unappliedPayment.deleteMany({ where: { order: { userId: { in: userIds } } } });
            await tx.order.deleteMany({ where: { userId: { in: userIds } } });
            await tx.cartItem.deleteMany({ where: { cart: { userId: { in: userIds } } } });
            await tx.cart.deleteMany({ where: { userId: { in: userIds } } });
            await tx.address.deleteMany({ where: { userId: { in: userIds } } });
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
        payments.setPaymentGateway?.(null);
        await server?.stop();
        await prisma.$disconnect();
    }
});

// ------------------------------------------------------------ unit

dbTest("unit: webhook signature is an HMAC of the exact raw bytes with the webhook secret", () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    const good = webhookSignature(body);

    assert.equal(webhooks.isValidWebhookSignature(body, good), true);
    assert.equal(webhooks.isValidWebhookSignature(body, good.toUpperCase()), true, "hex case does not matter");
    assert.equal(webhooks.isValidWebhookSignature(Buffer.from('{"event": "payment.captured"}'), good), false, "one extra space");
    assert.equal(webhooks.isValidWebhookSignature(body, webhookSignature(body, KEY_SECRET)), false, "API key secret is not the webhook secret");
    for (const bad of [undefined, "", "zz".repeat(32), good.slice(0, 63), `${good}0`, 42]) {
        assert.equal(webhooks.isValidWebhookSignature(body, bad), false, String(bad));
    }
    assert.equal(webhooks.isValidWebhookSignature(body.toString(), good), false, "a string is not the raw body");
    assert.equal(webhooks.isValidWebhookSignature(body, good, ""), false, "no secret configured");
});

dbTest("unit: the reservation boundary - the deadline itself counts as expired", () => {
    const deadline = epoch(0);
    const order = { reservationExpiresAt: deadline, paymentMethod: "RAZORPAY", status: "PENDING", paymentStatus: "UNPAID" };

    assert.equal(orders.reservationEnded(order, plus(deadline, -1)), false);
    assert.equal(orders.reservationEnded(order, deadline), true);
    assert.equal(orders.reservationEnded(order, plus(deadline, 1)), true);
    assert.equal(orders.isPayable(order, plus(deadline, -1)), true);
    assert.equal(orders.isPayable(order, deadline), false);
    assert.equal(orders.reservationEnded({ reservationExpiresAt: null }, deadline), false, "no deadline (COD, legacy) never ends");
    assert.equal(orders.RESERVATION_MINUTES, 30);
});

// ------------------------------------------------------------ placement

dbTest("placement: online orders get a deadline 30 minutes after placedAt; COD orders get none", async () => {
    const stock = await stockOf(variants[0]);
    const online = await place(alice);
    const row = await stored(online.id);

    assert.equal(row.reservationExpiresAt.getTime() - row.placedAt.getTime(), 30 * 60 * 1000);
    assert.equal(row.expiredAt, null);
    assert.equal(await stockOf(variants[0]), stock - 2, "stock is reserved once");
    assert.equal(online.payable, true);
    assert.equal(new Date(online.paymentDueBy).getTime(), row.reservationExpiresAt.getTime());

    const session = await payments.initiatePayment(alice.id, online.id);
    assert.ok(session.secondsRemaining > 29 * 60 && session.secondsRemaining <= 30 * 60, String(session.secondsRemaining));

    const cod = await place(alice, { paymentMethod: "COD" });
    assert.equal((await stored(cod.id)).reservationExpiresAt, null);
    assert.equal(cod.paymentDueBy, null);

    // Tidy: neither order should be swept by later tests.
    await orders.cancelOrder(alice.id, online.id);
    await orders.cancelOrder(alice.id, cod.id);
});

dbTest("deadline: after it, no new payment can be started and the order is not payable", async () => {
    const order = await initiated(alice, epoch(1));

    await rejectsWith(payments.initiatePayment(alice.id, order.id), 409, /time to pay/);
    const view = await orders.getOrder(alice.id, order.id);
    assert.equal(view.payable, false);
    assert.equal(view.paymentDueBy, null);
    assert.equal(view.status, "PENDING", "not cancelled until the worker expires it");

    await reservations.expireReservations({ now: plus(epoch(1), 1) });
});

// ------------------------------------------------------------ expiry

dbTest("expiry: kept before the deadline, expired exactly at it, stock returned once however often it runs", async () => {
    const deadline = plus(epoch(2), 10 * 60 * 1000);
    const stock = await stockOf(variants[0]);
    const order = await place(alice);
    await setDeadline(order.id, deadline);
    assert.equal(await stockOf(variants[0]), stock - 2);

    await reservations.expireReservations({ now: plus(deadline, -1) });
    assert.equal((await stored(order.id)).status, "PENDING", "1 ms before the deadline it is kept");
    assert.equal(await stockOf(variants[0]), stock - 2);

    const counts = await reservations.expireReservations({ now: deadline });
    assert.ok(counts.expired >= 1);
    const row = await stored(order.id);
    assert.equal(row.status, "CANCELLED");
    assert.equal(row.paymentStatus, "UNPAID");
    assert.equal(row.expiredAt.getTime(), deadline.getTime());
    assert.equal(await stockOf(variants[0]), stock, "stock returned");

    for (const later of [deadline, plus(deadline, 1), plus(deadline, DAY / 2)]) {
        await reservations.expireReservations({ now: later });
        assert.equal(await orders.expireOrder(order.id, later), false);
    }
    assert.equal(await stockOf(variants[0]), stock, "never returned twice");

    const view = await orders.getOrder(alice.id, order.id);
    assert.equal(view.expired, true);
    assert.equal(view.cancellable, false);
    assert.equal(view.refundDue, false);
});

dbTest("expiry: paid orders and cash-on-delivery orders are never expired", async () => {
    const deadline = epoch(3);
    const paid = await initiated(alice, null);
    await verify(alice, paid, gatewayPayment(paid.razorpayOrderId));
    await setDeadline(paid.id, deadline);

    const cod = await place(alice, { paymentMethod: "COD" });
    await setDeadline(cod.id, deadline); // a COD order never has one; even if it did

    const stock = await stockOf(variants[0]);
    await reservations.expireReservations({ now: plus(deadline, DAY / 2) });

    assert.deepEqual([(await stored(paid.id)).status, (await stored(paid.id)).paymentStatus], ["PENDING", "PAID"]);
    assert.equal((await stored(cod.id)).status, "PENDING");
    assert.equal(await stockOf(variants[0]), stock, "no stock returned for either");
    assert.equal(await orders.expireOrder(paid.id, plus(deadline, DAY / 2)), false);
    assert.equal(await orders.expireOrder(cod.id, plus(deadline, DAY / 2)), false);

    await orders.cancelOrder(alice.id, cod.id);
});

dbTest("expiry: concurrent sweeps and expiries return the stock exactly once", async () => {
    const deadline = epoch(4);
    const stock = await stockOf(variants[1]);
    const order = await place(bob, { variant: variants[1] });
    await setDeadline(order.id, deadline);
    const now = plus(deadline, 1000);

    const results = await Promise.all([
        ...Array.from({ length: 6 }, () => orders.expireOrder(order.id, now)),
        ...Array.from({ length: 3 }, () => reservations.expireReservations({ now })),
    ]);

    const wins = results.slice(0, 6).filter((r) => r === true).length
        + results.slice(6).reduce((sum, counts) => sum + counts.expired, 0);
    assert.equal(wins, 1, "exactly one expiry won");
    assert.equal((await stored(order.id)).status, "CANCELLED");
    assert.equal(await stockOf(variants[1]), stock);
});

dbTest("expiry: a failure halfway through rolls back the status and the stock; a retry then succeeds", async () => {
    const deadline = epoch(5);
    const stock = await stockOf(variants[0]);
    const order = await place(alice);
    await setDeadline(order.id, deadline);

    await assert.rejects(orders.expireOrder(order.id, deadline, {
        afterStep: (name) => { if (name === "restore") throw new Error("injected failure"); },
    }), /injected failure/);

    const row = await stored(order.id);
    assert.deepEqual([row.status, row.expiredAt], ["PENDING", null]);
    assert.equal(await stockOf(variants[0]), stock - 2, "stock still reserved");

    assert.equal(await orders.expireOrder(order.id, deadline), true);
    assert.equal(await stockOf(variants[0]), stock);
});

dbTest("expiry: Razorpay is asked first - captured pays, authorized or unreachable keeps, failed expires", async () => {
    const deadline = epoch(6);
    const now = plus(deadline, 1);

    const captured = await initiated(alice, deadline);
    gatewayPayment(captured.razorpayOrderId);
    const authorized = await initiated(alice, deadline);
    gatewayPayment(authorized.razorpayOrderId, { status: "authorized" });
    const failed = await initiated(alice, deadline);
    gatewayPayment(failed.razorpayOrderId, { status: "failed" });
    const unreachable = await initiated(bob, deadline, { variant: variants[1] });

    // Razorpay down for the unreachable one only: run it first in its own sweep window.
    gateway.down = true;
    try {
        const counts = await reservations.expireReservations({ now, batchSize: 1, maxBatches: 1 });
        assert.equal(counts.kept, 1);
    } finally {
        gateway.down = false;
    }

    const stock = await stockOf(variants[0]);
    await reservations.expireReservations({ now });

    assert.deepEqual([(await stored(captured.id)).status, (await stored(captured.id)).paymentStatus], ["PENDING", "PAID"]);
    assert.equal((await stored(authorized.id)).status, "PENDING", "payment in flight: kept");
    assert.equal((await stored(failed.id)).status, "CANCELLED");
    assert.equal(await stockOf(variants[0]), stock + 2, "only the failed one's stock came back");

    // Once the authorization is gone (released by Razorpay), it expires.
    gatewayPayments.get([...gatewayPayments.values()].find((p) => p.order_id === authorized.razorpayOrderId).id).status = "failed";
    await reservations.expireReservations({ now });
    assert.equal((await stored(authorized.id)).status, "CANCELLED");
    assert.equal((await stored(unreachable.id)).status, "CANCELLED", "expired once Razorpay answers");
});

dbTest("expiry: nothing is held in memory - a restarted worker finds orders that became due meanwhile", async () => {
    // A worker that ran and stopped (as in a shutdown) ...
    const stop = reservations.startReservationExpiryWorker({ intervalMs: 60 * 60 * 1000 });
    await stop();

    // ... an order becomes due while no worker runs ...
    const stock = await stockOf(variants[1]);
    const order = await place(bob, { variant: variants[1] });
    await setDeadline(order.id, epoch(7));

    // ... and the next process's first sweep (immediately at start) expires it.
    const stopAgain = reservations.startReservationExpiryWorker({ intervalMs: 60 * 60 * 1000 });
    await stopAgain();
    assert.equal((await stored(order.id)).status, "CANCELLED");
    assert.equal(await stockOf(variants[1]), stock);
});

// ------------------------------------------------------------ payment vs expiry

dbTest("race: a payment blocked behind an expiry in progress becomes a late payment and reinstates the order", async () => {
    const deadline = epoch(8);
    const stock = await stockOf(variants[0]);
    const order = await initiated(alice, deadline);
    const payment = gatewayPayment(order.razorpayOrderId);
    let pending;

    // The expiry holds the order's row lock (uncommitted) while the payment tries to mark it PAID.
    const expired = await orders.expireOrder(order.id, deadline, {
        afterStep: async (name) => {
            if (name !== "status") return;
            pending = verify(alice, order, payment);
            pending.catch(() => {});
            await waitForBlockedStatement();
        },
    });

    assert.equal(expired, true, "the expiry committed first");
    const { state } = await pending;
    assert.equal(state, "PAID", "the payment was then applied as a late payment");

    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["PENDING", "PAID", payment.id]);
    assert.ok(row.expiredAt, "the expiry stays on record");
    assert.equal(await stockOf(variants[0]), stock - 2, "released once, taken once: reserved exactly once");
    assert.deepEqual(await unapplied(order.id), []);
});

dbTest("race: an expiry blocked behind a payment in progress changes nothing", async () => {
    const deadline = epoch(9);
    const order = await initiated(alice, deadline);
    const payment = gatewayPayment(order.razorpayOrderId);
    const stock = await stockOf(variants[0]);
    let pending;

    // The same conditional UPDATE applyPayment makes, held open while the expiry runs.
    await prisma.$transaction(async (tx) => {
        const { count } = await tx.order.updateMany({
            where: { id: order.id, status: "PENDING", paymentStatus: { in: ["UNPAID", "FAILED"] } },
            data: { paymentStatus: "PAID", razorpayPaymentId: payment.id, paidAt: new Date() },
        });
        assert.equal(count, 1);
        pending = orders.expireOrder(order.id, plus(deadline, 1));
        pending.catch(() => {});
        await waitForBlockedStatement();
    }, { timeout: 30_000 });

    assert.equal(await pending, false, "the expiry re-checked the committed row and matched nothing");
    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus, row.expiredAt], ["PENDING", "PAID", null]);
    assert.equal(await stockOf(variants[0]), stock, "no stock returned for a paid order");
});

dbTest("race: payment and expiry fired together always end paid, with the stock reserved exactly once", async () => {
    for (let round = 0; round < 4; round++) {
        const deadline = plus(epoch(10), round * 1000);
        const stock = await stockOf(variants[1]);
        const order = await initiated(bob, deadline, { variant: variants[1] });
        const payment = gatewayPayment(order.razorpayOrderId);

        const body = paymentEvent("payment.captured", payment);
        const [, viaWebhook, viaBrowser] = await Promise.all([
            orders.expireOrder(order.id, plus(deadline, 1)),
            deliver(body),
            verify(bob, order, payment).catch((err) => err),
        ]);

        assert.equal(viaWebhook.status, 200);
        assert.ok(!(viaBrowser instanceof Error), viaBrowser?.message);
        const row = await stored(order.id);
        assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["PENDING", "PAID", payment.id], `round ${round}`);
        assert.equal(await stockOf(variants[1]), stock - 2, `round ${round}: reserved exactly once`);
        assert.deepEqual(await unapplied(order.id), []);
    }
});

// ------------------------------------------------------------ late payments

dbTest("late: a captured payment after expiry reinstates the order when the stock is still there", async () => {
    const deadline = epoch(11);
    const stock = await stockOf(variants[0]);
    const order = await initiated(alice, deadline);
    await reservations.expireReservations({ now: plus(deadline, 1) });
    assert.equal((await stored(order.id)).status, "CANCELLED");
    assert.equal(await stockOf(variants[0]), stock);

    const payment = gatewayPayment(order.razorpayOrderId);
    const res = await deliver(paymentEvent("payment.captured", payment));
    assert.equal(res.status, 200);
    assert.equal(res.body.outcome, "paid");

    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["PENDING", "PAID", payment.id]);
    assert.equal(await stockOf(variants[0]), stock - 2);

    // Paid now: the worker leaves it alone, and fulfilment can start.
    await reservations.expireReservations({ now: plus(deadline, DAY / 2) });
    assert.equal((await stored(order.id)).status, "PENDING");
    assert.equal((await orders.advanceOrderStatus(order.id, "CONFIRMED")).status, "CONFIRMED");
});

dbTest("late: after expiry with the stock gone, the order stays cancelled and the payment is recorded for a refund", async () => {
    const deadline = epoch(12);
    const order = await initiated(bob, deadline, { variant: variants[1] });
    await reservations.expireReservations({ now: plus(deadline, 1) });

    // Someone else bought the last units meanwhile.
    const saved = await stockOf(variants[1]);
    await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: 1 } });

    try {
        const payment = gatewayPayment(order.razorpayOrderId);
        const res = await deliver(paymentEvent("payment.captured", payment));
        assert.equal(res.status, 200, "a final answer: Razorpay must not retry it");
        assert.equal(res.body.outcome, "refused");

        const row = await stored(order.id);
        assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["CANCELLED", "UNPAID", null]);
        assert.equal(await stockOf(variants[1]), 1, "not oversold");

        const [record] = await unapplied(order.id);
        assert.equal(record.razorpayPaymentId, payment.id);
        assert.equal(record.razorpayOrderId, order.razorpayOrderId);
        assert.deepEqual([record.amount, record.currency, record.reason], [4000, "USD", "expired_stock_unavailable"]);
        assert.equal(record.refundedAt, null, "no refund is assumed");

        // The browser's verification of the same payment gets the same answer and adds nothing.
        await rejectsWith(verify(bob, order, payment), 409, /refunded/);
        assert.equal((await unapplied(order.id)).length, 1);

        // Visible to the customer (refund due) and to admins (the payment itself).
        const customerView = await fetch(`${server.url}/orders/${order.id}`, { headers: bob.headers }).then((r) => r.json());
        assert.equal(customerView.data.refundDue, true);
        assert.equal(customerView.data.expired, true);
        const adminView = await fetch(`${server.url}/admin/orders/${order.id}`, { headers: admin.headers }).then((r) => r.json());
        assert.equal(adminView.data.unappliedPayments.length, 1);
        assert.equal(adminView.data.unappliedPayments[0].razorpayPaymentId, payment.id);
        assert.equal(adminView.data.nextStatus, null, "a cancelled order cannot be fulfilled");
        const list = await fetch(`${server.url}/admin/orders?limit=100`, { headers: admin.headers }).then((r) => r.json());
        assert.equal(list.data.find((o) => o.id === order.id)?.refundDue, true);
    } finally {
        await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: saved } });
    }
});

dbTest("late: a reinstatement that fails halfway rolls back; the webhook's retry then succeeds", async () => {
    const deadline = epoch(13);
    const stock = await stockOf(variants[0]);
    const order = await initiated(alice, deadline);
    await reservations.expireReservations({ now: plus(deadline, 1) });
    const payment = gatewayPayment(order.razorpayOrderId);

    await assert.rejects(orders.reinstateExpiredOrder(await stored(order.id), payment, {
        afterStep: (name) => { if (name === "stock") throw new Error("injected failure"); },
    }), /injected failure/);
    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["CANCELLED", "UNPAID", null]);
    assert.equal(await stockOf(variants[0]), stock, "nothing taken");

    const res = await deliver(paymentEvent("payment.captured", payment));
    assert.equal(res.body.outcome, "paid");
    assert.equal(await stockOf(variants[0]), stock - 2);
});

dbTest("late: a payment for an order the customer cancelled is never applied; it is recorded once for a refund", async () => {
    const order = await initiated(alice, null);
    await orders.cancelOrder(alice.id, order.id);
    const stock = await stockOf(variants[0]);

    const payment = gatewayPayment(order.razorpayOrderId);
    const body = paymentEvent("payment.captured", payment);
    for (let i = 0; i < 3; i++) {
        const res = await deliver(body); // a new event id each time: Razorpay re-sent it
        assert.equal(res.status, 200);
        assert.equal(res.body.outcome, "refused");
    }

    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus, row.expiredAt], ["CANCELLED", "UNPAID", null]);
    assert.equal(await stockOf(variants[0]), stock, "no stock taken");
    const records = await unapplied(order.id);
    assert.equal(records.length, 1, "one record however often it is reported");
    assert.equal(records[0].reason, "order_not_payable");
});

dbTest("late: repeated captures after a reinstatement neither re-take stock nor create refunds for the payment that paid", async () => {
    const deadline = epoch(14);
    const order = await initiated(bob, deadline, { variant: variants[1] });
    await reservations.expireReservations({ now: plus(deadline, 1) });
    const payment = gatewayPayment(order.razorpayOrderId);
    const body = paymentEvent("payment.captured", payment);

    assert.equal((await deliver(body)).body.outcome, "paid");
    const stock = await stockOf(variants[1]);
    for (let i = 0; i < 3; i++) assert.equal((await deliver(body)).body.outcome, "paid");
    assert.equal((await deliver(paymentEvent("order.paid", payment))).body.outcome, "paid");
    assert.equal(await stockOf(variants[1]), stock);
    assert.deepEqual(await unapplied(order.id), []);

    // A second, different captured payment for the same gateway order: refund owed for that one only.
    const second = gatewayPayment(order.razorpayOrderId);
    assert.equal((await deliver(paymentEvent("payment.captured", second))).body.outcome, "refused");
    const records = await unapplied(order.id);
    assert.deepEqual(records.map((r) => [r.razorpayPaymentId, r.reason]), [[second.id, "order_already_paid"]]);
    assert.equal((await stored(order.id)).razorpayPaymentId, payment.id);
});

dbTest("refund: only Razorpay's refund.processed for the full amount marks a refund done, once", async () => {
    const order = await initiated(alice, null);
    await orders.cancelOrder(alice.id, order.id);
    const payment = gatewayPayment(order.razorpayOrderId);
    await deliver(paymentEvent("payment.captured", payment));

    // Partial: not done.
    const partial = await deliver(refundEvent({ id: nextId("rfnd"), payment_id: payment.id, amount: 1000, currency: "USD" }));
    assert.equal(partial.body.outcome, "refund_not_tracked");
    assert.equal((await unapplied(order.id))[0].refundedAt, null);

    const refundId = nextId("rfnd");
    const full = refundEvent({ id: refundId, payment_id: payment.id, amount: 4000, currency: "USD" });
    assert.equal((await deliver(full)).body.outcome, "refund_recorded");
    const [record] = await unapplied(order.id);
    assert.ok(record.refundedAt);
    assert.equal(record.razorpayRefundId, refundId);

    // Re-sent: recorded once.
    assert.equal((await deliver(full)).body.outcome, "refund_not_tracked");
    assert.equal((await unapplied(order.id))[0].refundedAt.getTime(), record.refundedAt.getTime());
    assert.equal((await orders.getOrder(alice.id, order.id)).refundDue, false);
});

// ------------------------------------------------------------ webhook endpoint

dbTest("webhook: a valid captured payment pays the order and is recorded", async () => {
    const order = await initiated(alice, null);
    const payment = gatewayPayment(order.razorpayOrderId);
    const eventId = newEventId();

    const res = await deliver(paymentEvent("payment.captured", payment), { eventId });
    assert.equal(res.status, 200);
    assert.deepEqual([res.body.status, res.body.outcome], ["processed", "paid"]);

    const row = await stored(order.id);
    assert.deepEqual([row.paymentStatus, row.razorpayPaymentId], ["PAID", payment.id]);
    const event = await prisma.razorpayWebhookEvent.findUnique({ where: { eventKey: eventId } });
    assert.deepEqual([event.event, event.outcome, event.razorpayOrderId, event.razorpayPaymentId],
        ["payment.captured", "paid", order.razorpayOrderId, payment.id]);

    // The browser's verification afterwards agrees.
    assert.equal((await verify(alice, order, payment)).state, "PAID");
});

dbTest("webhook: missing, invalid, malformed or wrongly keyed signatures are refused before anything is read", async () => {
    const order = await initiated(alice, null);
    const payment = gatewayPayment(order.razorpayOrderId);
    const body = paymentEvent("payment.captured", payment);
    const eventId = newEventId();

    for (const signature of [null, "", "nothex", webhookSignature(body).slice(1), webhookSignature(`${body} `), webhookSignature(body, KEY_SECRET)]) {
        const res = await deliver(body, { eventId, signature });
        assert.equal(res.status, 400, String(signature));
        assert.equal(res.body.message, "Invalid webhook signature");
    }
    // A body that is not JSON at all, even correctly signed, is refused (after the signature).
    const junk = "not json";
    assert.equal((await deliver(junk, { signature: webhookSignature(junk) })).status, 400);

    assert.equal((await stored(order.id)).paymentStatus, "UNPAID");
    assert.equal(await prisma.razorpayWebhookEvent.count({ where: { eventKey: eventId } }), 0, "nothing recorded");

    // Without a webhook secret configured the endpoint processes nothing (503: Razorpay retries later).
    const saved = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    try {
        await rejectsWith(handle(body), 503);
    } finally {
        process.env.RAZORPAY_WEBHOOK_SECRET = saved;
    }
});

dbTest("webhook: malformed payloads and unknown payments", async () => {
    const order = await initiated(alice, null);

    for (const entity of [
        { id: "pay_x", order_id: order.razorpayOrderId, amount: "4000", currency: "USD", status: "captured" },
        { id: "not-a-payment", order_id: order.razorpayOrderId, amount: 4000, currency: "USD", status: "captured" },
        { id: nextId("pay"), amount: 4000, currency: "USD", status: "captured" },
        { id: nextId("pay"), order_id: order.razorpayOrderId, amount: 4000, currency: "usd", status: "captured" },
    ]) {
        const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity } } });
        assert.equal((await deliver(body)).status, 400, JSON.stringify(entity));
    }
    assert.equal((await deliver(JSON.stringify({ event: "payment.captured", payload: {} }))).status, 400);

    // A well-formed payment for a gateway order this shop never created.
    const stranger = gatewayPayment(nextId("order"));
    created.gatewayOrders.push(stranger.order_id);
    const res = await deliver(paymentEvent("payment.captured", stranger));
    assert.deepEqual([res.status, res.body.outcome], [200, "unknown_order"]);

    // Events this shop does not use are acknowledged and ignored.
    const other = JSON.stringify({ event: "settlement.processed", payload: {} });
    assert.deepEqual([(await deliver(other)).body.outcome], ["ignored"]);

    assert.equal((await stored(order.id)).paymentStatus, "UNPAID");
});

dbTest("webhook: amount or currency mismatches never pay the order and are recorded for a refund", async () => {
    for (const overrides of [{ amount: 3999 }, { amount: 400000 }, { currency: "INR" }]) {
        const order = await initiated(alice, null);
        const payment = gatewayPayment(order.razorpayOrderId, overrides);

        const res = await deliver(paymentEvent("payment.captured", payment));
        assert.deepEqual([res.status, res.body.outcome], [200, "refused"], JSON.stringify(overrides));

        assert.equal((await stored(order.id)).paymentStatus, "UNPAID");
        const [record] = await unapplied(order.id);
        assert.deepEqual([record.reason, record.amount, record.currency],
            ["amount_or_currency_mismatch", payment.amount, payment.currency]);
    }
});

dbTest("webhook: a payment is applied only to the order of its own gateway order", async () => {
    const mine = await initiated(alice, null);
    const theirs = await initiated(bob, null, { variant: variants[1] });
    const payment = gatewayPayment(mine.razorpayOrderId);

    assert.equal((await deliver(paymentEvent("payment.captured", payment))).body.outcome, "paid");
    assert.equal((await stored(mine.id)).paymentStatus, "PAID");
    assert.equal((await stored(theirs.id)).paymentStatus, "UNPAID");

    // Presented for the other order through the browser flow: refused, nothing changes.
    await rejectsWith(payments.verifyPayment(bob.id, theirs.id, {
        razorpayOrderId: theirs.razorpayOrderId, razorpayPaymentId: payment.id,
        razorpaySignature: checkoutSignature(theirs.razorpayOrderId, payment.id),
    }), 409);
    assert.equal((await stored(theirs.id)).paymentStatus, "UNPAID");
});

dbTest("webhook: duplicate and concurrent deliveries of one event settle once", async () => {
    const order = await initiated(alice, null);
    const payment = gatewayPayment(order.razorpayOrderId);
    const body = paymentEvent("payment.captured", payment);
    const eventId = newEventId();
    const stock = await stockOf(variants[0]);

    const results = await Promise.all(Array.from({ length: 6 }, () => deliver(body, { eventId })));
    assert.ok(results.every((r) => r.status === 200), JSON.stringify(results));
    assert.ok(results.every((r) => r.body.outcome === "paid"));

    const again = await deliver(body, { eventId });
    assert.deepEqual([again.body.status, again.body.outcome], ["duplicate", "paid"]);

    assert.equal(await prisma.razorpayWebhookEvent.count({ where: { eventKey: eventId } }), 1);
    const row = await stored(order.id);
    assert.deepEqual([row.paymentStatus, row.razorpayPaymentId], ["PAID", payment.id]);
    assert.equal(await stockOf(variants[0]), stock, "no stock moved");
    assert.deepEqual(await unapplied(order.id), []);

    // Without an event id header the body hash is the key: redeliveries are still recognised.
    const order2 = await initiated(alice, null);
    const body2 = paymentEvent("payment.captured", gatewayPayment(order2.razorpayOrderId));
    assert.equal((await deliver(body2, { eventId: null })).body.status, "processed");
    assert.equal((await deliver(body2, { eventId: null })).body.status, "duplicate");
});

dbTest("webhook: failed payments before or after a capture never undo it", async () => {
    const order = await initiated(alice, null);
    const failedFirst = gatewayPayment(order.razorpayOrderId, { status: "failed" });

    assert.equal((await deliver(paymentEvent("payment.failed", failedFirst))).body.outcome, "failed_ignored");
    assert.deepEqual([(await stored(order.id)).status, (await stored(order.id)).paymentStatus], ["PENDING", "UNPAID"]);
    assert.equal((await orders.getOrder(alice.id, order.id)).payable, true, "still payable after a failed attempt");

    const captured = gatewayPayment(order.razorpayOrderId);
    assert.equal((await deliver(paymentEvent("payment.captured", captured))).body.outcome, "paid");

    // A failure event arriving late, even for the very payment that paid, changes nothing.
    for (const p of [gatewayPayment(order.razorpayOrderId, { status: "failed" }), { ...captured, status: "failed" }]) {
        assert.equal((await deliver(paymentEvent("payment.failed", p))).body.outcome, "failed_ignored");
    }
    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["PENDING", "PAID", captured.id]);
});

dbTest("webhook: a failure after the changes commit is not recorded; Razorpay's retry is answered from the order", async () => {
    const order = await initiated(alice, null);
    const payment = gatewayPayment(order.razorpayOrderId);
    const body = paymentEvent("payment.captured", payment);
    const eventId = newEventId();

    await assert.rejects(handle(body, eventId, { beforeRecord: () => { throw new Error("injected failure"); } }), /injected failure/);
    assert.equal((await stored(order.id)).paymentStatus, "PAID", "the payment itself committed");
    assert.equal(await prisma.razorpayWebhookEvent.count({ where: { eventKey: eventId } }), 0, "not marked handled");

    // Over HTTP the same failure is a 500, so Razorpay retries; the retry settles nothing twice.
    const retry = await handle(body, eventId);
    assert.deepEqual([retry.status, retry.outcome], ["processed", "paid"]);
    assert.equal(await prisma.razorpayWebhookEvent.count({ where: { eventKey: eventId } }), 1);
    assert.equal((await stored(order.id)).razorpayPaymentId, payment.id);
});

dbTest("webhook: responses and logs never contain the secrets", async () => {
    const order = await initiated(alice, null);
    const lines = [];
    const original = { log: console.log, warn: console.warn, error: console.error };
    for (const level of Object.keys(original)) console[level] = (...args) => lines.push(args.join(" "));
    try {
        await handle(paymentEvent("payment.captured", gatewayPayment(order.razorpayOrderId, { amount: 1 })));
        await handle(paymentEvent("payment.captured", gatewayPayment(nextId("order"))));
    } finally {
        Object.assign(console, original);
    }
    const res = await deliver(paymentEvent("payment.captured", gatewayPayment(order.razorpayOrderId)), { signature: "0".repeat(64) });
    const text = [...lines, JSON.stringify(res.body), server.output()].join("\n");
    assert.ok(lines.length > 0, "something was logged");
    for (const secret of [WEBHOOK_SECRET, KEY_SECRET]) assert.ok(!text.includes(secret), "secret leaked");
});

// ------------------------------------------------------------ refund guard (late payments)

// An expired online order of bob's (variants[1]) whose late capture found no
// stock: the payment is recorded for a refund. Returns { order, payment }.
async function lateRefundDue(day) {
    const deadline = epoch(day);
    const order = await initiated(bob, deadline, { variant: variants[1] });
    await reservations.expireReservations({ now: plus(deadline, 1) });
    assert.equal((await stored(order.id)).status, "CANCELLED");

    await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: 1 } });
    const payment = gatewayPayment(order.razorpayOrderId);
    const res = await deliver(paymentEvent("payment.captured", payment));
    assert.equal(res.body.outcome, "refused");
    return { order, payment };
}

async function assertRefundStands(order, payment, stockNow, label) {
    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["CANCELLED", "UNPAID", null], label);
    assert.equal(await stockOf(variants[1]), stockNow, `${label}: no stock taken`);
    const records = await unapplied(order.id);
    assert.deepEqual(records.map((r) => [r.razorpayPaymentId, r.reason]), [[payment.id, "expired_stock_unavailable"]], label);
}

dbTest("refund guard: once recorded, restocking never lets the same payment reinstate the order, on any path", async () => {
    const saved = await stockOf(variants[1]);
    try {
        const { order, payment } = await lateRefundDue(20);

        // Restocked: there would now be enough for the order.
        await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: 50 } });

        await rejectsWith(verify(bob, order, payment), 409, /refunded/);
        await assertRefundStands(order, payment, 50, "browser verification");

        await rejectsWith(payments.refreshPayment(bob.id, order.id), 409, /refunded/);
        await assertRefundStands(order, payment, 50, "refresh");

        for (const event of ["payment.captured", "order.paid"]) {
            const res = await deliver(paymentEvent(event, payment));
            assert.deepEqual([res.status, res.body.outcome], [200, "refused"], event);
            await assertRefundStands(order, payment, 50, event);
        }

        assert.equal(await orders.reinstateExpiredOrder(await stored(order.id), payment), "REFUND_DUE", "the service itself refuses");
        await reservations.expireReservations({ now: plus(epoch(20), 2), lateCheckEveryMs: 0 });
        await assertRefundStands(order, payment, 50, "worker sweep");

        // Visible as owed to the customer and to admins.
        assert.equal((await orders.getOrder(bob.id, order.id)).refundDue, true);
        const adminView = await fetch(`${server.url}/admin/orders/${order.id}`, { headers: admin.headers }).then((r) => r.json());
        assert.equal(adminView.data.unappliedPayments[0].refundedAt, null);

        // Even once Razorpay confirms the refund, the payment never fulfils the order.
        await deliver(refundEvent({ id: nextId("rfnd"), payment_id: payment.id, amount: 4000, currency: "USD" }));
        assert.ok((await unapplied(order.id))[0].refundedAt);
        assert.equal(await orders.reinstateExpiredOrder(await stored(order.id), payment), "REFUND_DUE");
        assert.equal((await stored(order.id)).status, "CANCELLED");
    } finally {
        await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: saved } });
    }
});

dbTest("refund guard: a record committed while a reinstatement waits for the order lock is seen, not overtaken", async () => {
    const deadline = epoch(21);
    const order = await initiated(alice, deadline);
    await reservations.expireReservations({ now: plus(deadline, 1) });
    const payment = gatewayPayment(order.razorpayOrderId);
    const stock = await stockOf(variants[0]);
    let pending;

    // Another path holds the order row and records the payment for a refund
    // while the reinstatement (stock available) is blocked behind it.
    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;
        pending = orders.reinstateExpiredOrder(await stored(order.id), payment);
        pending.catch(() => {});
        await waitForBlockedStatement();
        await tx.unappliedPayment.create({
            data: { orderId: order.id, razorpayPaymentId: payment.id, razorpayOrderId: order.razorpayOrderId, amount: 4000, currency: "USD", reason: "expired_stock_unavailable" },
        });
    }, { timeout: 30_000 });

    assert.equal(await pending, "REFUND_DUE");
    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus], ["CANCELLED", "UNPAID"]);
    assert.equal(await stockOf(variants[0]), stock, "no stock taken");
});

dbTest("refund guard: concurrent late processing while stock arrives ends in exactly one outcome", async () => {
    const saved = await stockOf(variants[1]);
    try {
        for (let round = 0; round < 4; round++) {
            const deadline = plus(epoch(22), round * 1000);
            const order = await initiated(bob, deadline, { variant: variants[1] });
            await reservations.expireReservations({ now: plus(deadline, 1) });
            const payment = gatewayPayment(order.razorpayOrderId);

            // 1 unit (not enough for 2) while the attempts start; 5 more arrive meanwhile.
            await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: 1 } });
            await Promise.all([
                deliver(paymentEvent("payment.captured", payment)),
                deliver(paymentEvent("order.paid", payment)),
                verify(bob, order, payment).catch(() => {}),
                payments.refreshPayment(bob.id, order.id).catch(() => {}),
                prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: { increment: 5 } } }),
                deliver(paymentEvent("payment.captured", payment)),
            ]);

            const row = await stored(order.id);
            const records = await unapplied(order.id);
            const stock = await stockOf(variants[1]);
            if (row.paymentStatus === "PAID") {
                assert.equal(row.status, "PENDING", `round ${round}`);
                assert.deepEqual(records, [], `round ${round}: paid, so no refund owed`);
                assert.equal(stock, 1 + 5 - 2, `round ${round}: taken exactly once`);
            } else {
                assert.equal(row.status, "CANCELLED", `round ${round}`);
                assert.equal(records.length, 1, `round ${round}: one refund record`);
                assert.equal(stock, 1 + 5, `round ${round}: nothing taken`);
            }
        }
    } finally {
        await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: saved } });
    }
});

dbTest("refund guard: a failure while recording loses nothing; the worker's late-payment check records it later", async () => {
    const saved = await stockOf(variants[1]);
    try {
        const deadline = epoch(23);
        const order = await initiated(bob, deadline, { variant: variants[1] });
        await reservations.expireReservations({ now: plus(deadline, 1) });
        await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: 1 } });
        const payment = gatewayPayment(order.razorpayOrderId);

        // The database fails after the record is written but before commit.
        await assert.rejects(orders.reinstateExpiredOrder(await stored(order.id), payment, {
            afterStep: (name) => { if (name === "refund_due") throw new Error("injected failure"); },
        }), /injected failure/);
        assert.deepEqual(await unapplied(order.id), [], "rolled back: nothing half-recorded");
        assert.equal((await stored(order.id)).status, "CANCELLED");

        // No webhook, no customer: the next sweep's late-payment check finds the capture.
        const counts = await reservations.expireReservations({ now: plus(deadline, 60 * 1000), lateCheckEveryMs: 0 });
        assert.equal(counts.late_refund_due, 1);
        await assertRefundStands(order, payment, 1, "after the worker's check");

        // Recorded once: later sweeps skip it.
        const again = await reservations.expireReservations({ now: plus(deadline, 120 * 1000), lateCheckEveryMs: 0 });
        assert.equal(again.late_refund_due + again.late_paid + again.late_none, 0);
        assert.equal((await unapplied(order.id)).length, 1);
    } finally {
        await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: saved } });
    }
});

dbTest("late check: a capture found after expiry with stock available reinstates the order once; the window is bounded", async () => {
    const deadline = epoch(24);
    const stock = await stockOf(variants[0]);
    const order = await initiated(alice, deadline);
    await reservations.expireReservations({ now: plus(deadline, 1) });
    assert.equal(await stockOf(variants[0]), stock);

    const payment = gatewayPayment(order.razorpayOrderId);
    const counts = await reservations.expireReservations({ now: plus(deadline, 5 * 60 * 1000), lateCheckEveryMs: 0 });
    assert.equal(counts.late_paid, 1);
    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["PENDING", "PAID", payment.id]);
    assert.equal(await stockOf(variants[0]), stock - 2);

    // Outside the 24-hour window an expired order is no longer asked about.
    const old = await initiated(alice, plus(deadline, 1000));
    await reservations.expireReservations({ now: plus(deadline, 2000) });
    gatewayPayment(old.razorpayOrderId);
    const fetches = gateway.fetches;
    await reservations.expireReservations({ now: plus(deadline, 2 * DAY), lateCheckEveryMs: 0 });
    assert.equal(gateway.fetches, fetches, "not asked after the window");
    assert.equal((await stored(old.id)).status, "CANCELLED");
});

// ------------------------------------------------------------ payments in flight (expiry)

dbTest("in flight: a created (pending UPI) payment at the deadline keeps the reservation; its capture settles once", async () => {
    const deadline = epoch(30);
    const order = await initiated(alice, deadline);
    const pendingUpi = gatewayPayment(order.razorpayOrderId, { status: "created", method: "upi" });
    const stock = await stockOf(variants[0]);

    for (const now of [deadline, plus(deadline, 1), plus(deadline, 10 * 60 * 1000)]) {
        const counts = await reservations.expireReservations({ now });
        assert.equal(counts.expired, 0);
        assert.equal((await stored(order.id)).status, "PENDING", "kept while the payment is in flight");
    }
    assert.equal(await stockOf(variants[0]), stock, "still reserved");

    // The customer sees it as being processed and cannot cancel it meanwhile.
    assert.equal((await payments.refreshPayment(alice.id, order.id)).state, "PROCESSING");
    await rejectsWith(payments.cancelOrderAfterPaymentCheck(alice.id, order.id), 409, /still being processed/);

    pendingUpi.status = "captured";
    const counts = await reservations.expireReservations({ now: plus(deadline, 11 * 60 * 1000) });
    assert.equal(counts.paid, 1);
    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["PENDING", "PAID", pendingUpi.id]);

    // Repeated sweeps and the webhook for the same capture change nothing more.
    await reservations.expireReservations({ now: plus(deadline, 12 * 60 * 1000) });
    assert.equal((await deliver(paymentEvent("payment.captured", pendingUpi))).body.outcome, "paid");
    assert.equal(await stockOf(variants[0]), stock, "reserved exactly once");
    assert.deepEqual(await unapplied(order.id), []);
});

dbTest("in flight: once the pending payment definitively fails, the next sweep expires the order and returns stock once", async () => {
    const deadline = epoch(31);
    const stock = await stockOf(variants[0]);
    const order = await initiated(alice, deadline);
    const attempt = gatewayPayment(order.razorpayOrderId, { status: "created" });

    await reservations.expireReservations({ now: deadline });
    assert.equal((await stored(order.id)).status, "PENDING");
    assert.equal(await stockOf(variants[0]), stock - 2);

    attempt.status = "failed";
    const counts = await reservations.expireReservations({ now: plus(deadline, 60 * 1000) });
    assert.equal(counts.expired, 1);
    assert.equal((await stored(order.id)).status, "CANCELLED");
    assert.equal(await stockOf(variants[0]), stock);

    for (let i = 2; i < 5; i++) await reservations.expireReservations({ now: plus(deadline, i * 60 * 1000) });
    assert.equal(await stockOf(variants[0]), stock, "returned exactly once");
});

dbTest("in flight: unknown statuses, partial or malformed lists and network errors all keep the reservation", async () => {
    const deadline = epoch(32);
    const stock = await stockOf(variants[0]);
    const order = await initiated(alice, deadline);
    const attempt = gatewayPayment(order.razorpayOrderId, { status: "pending_review" });
    const sweep = (minutes) => reservations.expireReservations({ now: plus(deadline, minutes * 60 * 1000) });
    const kept = async (label) => {
        assert.equal((await stored(order.id)).status, "PENDING", label);
        assert.equal(await stockOf(variants[0]), stock - 2, `${label}: still reserved`);
    };

    await sweep(1);
    await kept("a status Razorpay does not document");

    // From here the only payment has failed, so a trusted answer would expire it.
    attempt.status = "failed";
    const cases = [
        ["more payments than listed (count > items)", (id, r) => ({ ...r, count: r.count + 1 })],
        ["no count", (id, r) => ({ entity: "collection", items: r.items })],
        ["no items", () => ({ entity: "collection", count: 0 })],
        ["an item of another gateway order", (id, r) => ({ ...r, items: r.items.map((p) => ({ ...p, order_id: "order_Someone" })) })],
        ["an item without a status", (id, r) => ({ ...r, items: r.items.map(({ status, ...p }) => p) })],
        ["an empty body", () => null],
    ];
    for (const [label, respond] of cases) {
        gateway.respond = respond;
        try {
            await sweep(2);
        } finally {
            gateway.respond = null;
        }
        await kept(label);
    }

    gateway.down = true;
    try {
        await sweep(3);
    } finally {
        gateway.down = false;
    }
    await kept("Razorpay unreachable");

    // A complete, reliable answer (its only payment failed): expired, stock returned once.
    await sweep(4);
    assert.equal((await stored(order.id)).status, "CANCELLED");
    assert.equal(await stockOf(variants[0]), stock);
});

dbTest("in flight: several payments on one gateway order are reconciled safely", async () => {
    const deadline = epoch(33);
    const now = plus(deadline, 1);
    const make = async (statuses) => {
        const order = await initiated(alice, deadline);
        const list = statuses.map((s) => gatewayPayment(order.razorpayOrderId, typeof s === "string" ? { status: s } : s));
        return { order, list };
    };

    const failedThenCaptured = await make(["failed", "captured"]);
    const failedThenAuthorized = await make(["failed", "authorized"]);
    const failedThenCreated = await make(["failed", "created"]);
    const wrongCaptureAndCreated = await make([{ status: "captured", amount: 3999 }, "created"]);
    const wrongCaptureOnly = await make(["failed", { status: "captured", amount: 3999 }]);
    const twoCaptures = await make(["captured", "captured"]);
    const failedAndRefunded = await make(["failed", "refunded"]);

    const stock = await stockOf(variants[0]);
    await reservations.expireReservations({ now });

    const state = async ({ order }) => {
        const row = await stored(order.id);
        return [row.status, row.paymentStatus];
    };

    assert.deepEqual(await state(failedThenCaptured), ["PENDING", "PAID"]);
    assert.equal((await stored(failedThenCaptured.order.id)).razorpayPaymentId, failedThenCaptured.list[1].id);

    assert.deepEqual(await state(failedThenAuthorized), ["PENDING", "UNPAID"], "authorized: in flight");
    assert.deepEqual(await state(failedThenCreated), ["PENDING", "UNPAID"], "created: in flight");

    // A capture of the wrong amount never pays the order, is recorded for a
    // refund, and does not hide a payment still in flight.
    assert.deepEqual(await state(wrongCaptureAndCreated), ["PENDING", "UNPAID"]);
    assert.deepEqual((await unapplied(wrongCaptureAndCreated.order.id)).map((r) => r.reason), ["amount_or_currency_mismatch"]);

    // Nothing else in flight: the order expires, and the wrong capture stays owed.
    assert.deepEqual(await state(wrongCaptureOnly), ["CANCELLED", "UNPAID"]);
    assert.deepEqual((await unapplied(wrongCaptureOnly.order.id)).map((r) => r.reason), ["amount_or_currency_mismatch"]);

    // Two captures: the first pays, the second is owed back.
    assert.deepEqual(await state(twoCaptures), ["PENDING", "PAID"]);
    assert.equal((await stored(twoCaptures.order.id)).razorpayPaymentId, twoCaptures.list[0].id);
    assert.deepEqual((await unapplied(twoCaptures.order.id)).map((r) => [r.razorpayPaymentId, r.reason]), [[twoCaptures.list[1].id, "duplicate_capture"]]);

    // Every payment final with no money held: expired.
    assert.deepEqual(await state(failedAndRefunded), ["CANCELLED", "UNPAID"]);

    // Exactly the two expired orders returned their stock, and a repeat sweep moves nothing.
    assert.equal(await stockOf(variants[0]), stock + 2 * 2);
    await reservations.expireReservations({ now: plus(now, 1000) });
    assert.equal(await stockOf(variants[0]), stock + 2 * 2, "repeat sweep moves nothing");

    // Tidy: the kept ones' attempts fail, so they expire and later tests start clean.
    for (const { list } of [failedThenAuthorized, failedThenCreated, wrongCaptureAndCreated]) {
        for (const p of list) if (p.status !== "captured") p.status = "failed";
    }
    await reservations.expireReservations({ now: plus(now, 2000) });
});

// ------------------------------------------------------------ reconciliation with Razorpay's payment list

const secondsOf = (date) => Math.floor(date.getTime() / 1000);
const reconcile = (now, options = {}) => payments.reconcileRecentPayments({ now, ...options });
// Later tests narrow the window to their own day, so earlier tests' payments stay out of their counts.
const OWN_DAY = { windowMs: 6 * 60 * 60 * 1000 };

dbTest("reconciliation: pages through the window, settles every kind of captured payment once, and reruns change nothing", async () => {
    const base = epoch(40);
    const at = (minutes) => secondsOf(plus(base, minutes * 60 * 1000));
    const stock0 = await stockOf(variants[0]);

    // A: still payable, its capture never reported (closed tab, webhook down).
    const a = await initiated(alice, null);
    const pa = gatewayPayment(a.razorpayOrderId, { created_at: at(10) });
    // B: expired, captured late, stock available -> reinstated.
    const b = await initiated(alice, base);
    await reservations.expireReservations({ now: plus(base, 1) });
    const pb = gatewayPayment(b.razorpayOrderId, { created_at: at(20) });
    // C: cancelled by the customer, then captured -> refund owed.
    const c = await initiated(alice, null);
    await orders.cancelOrder(alice.id, c.id);
    const pc = gatewayPayment(c.razorpayOrderId, { created_at: at(30) });
    // D: captured for the wrong amount -> refund owed, never paid.
    const d = await initiated(alice, null);
    const pd = gatewayPayment(d.razorpayOrderId, { amount: 3999, created_at: at(40) });
    // A gateway order this shop never created, a failed attempt, and a capture outside the window.
    const stranger = gatewayPayment(nextId("order"), { created_at: at(50) });
    created.gatewayOrders.push(stranger.order_id);
    const e = await initiated(alice, null);
    gatewayPayment(e.razorpayOrderId, { status: "failed", created_at: at(60) });
    const old = await initiated(alice, null);
    gatewayPayment(old.razorpayOrderId, { created_at: secondsOf(plus(base, -5 * DAY)) });

    const stockBefore = await stockOf(variants[0]);
    const now = plus(base, 2 * 60 * 60 * 1000);
    const first = await reconcile(now, { pageSize: 2 });

    assert.equal(first.complete, true, JSON.stringify(first));
    assert.ok(first.pages >= 3, "more than one page");
    assert.deepEqual([first.paid, first.refused, first.unknown_order, first.failed], [2, 2, 1, 0], JSON.stringify(first));

    const row = async (o) => { const r = await stored(o.id); return [r.status, r.paymentStatus, r.razorpayPaymentId]; };
    assert.deepEqual(await row(a), ["PENDING", "PAID", pa.id]);
    assert.deepEqual(await row(b), ["PENDING", "PAID", pb.id]);
    assert.deepEqual(await row(c), ["CANCELLED", "UNPAID", null]);
    assert.deepEqual(await row(d), ["PENDING", "UNPAID", null]);
    assert.deepEqual((await unapplied(c.id)).map((r) => [r.razorpayPaymentId, r.reason]), [[pc.id, "order_not_payable"]]);
    assert.deepEqual((await unapplied(d.id)).map((r) => [r.razorpayPaymentId, r.reason, r.amount]), [[pd.id, "amount_or_currency_mismatch", 3999]]);
    assert.deepEqual([(await stored(old.id)).paymentStatus, (await stored(e.id)).paymentStatus], ["UNPAID", "UNPAID"], "outside the window / failed: untouched");
    assert.equal(await stockOf(variants[0]), stockBefore - 2, "only B's reinstatement took stock");

    // Rerun: everything is recognised, nothing is written again.
    const second = await reconcile(plus(now, 60 * 60 * 1000), { pageSize: 2 });
    assert.deepEqual([second.paid, second.refused, second.settled_before, second.recorded_before], [0, 0, 2, 2], JSON.stringify(second));
    assert.equal(await stockOf(variants[0]), stockBefore - 2);
    assert.equal((await unapplied(c.id)).length + (await unapplied(d.id)).length, 2);

    await orders.cancelOrder(alice.id, d.id);
    await orders.cancelOrder(alice.id, e.id);
    await orders.cancelOrder(alice.id, old.id);
    assert.ok(stock0 >= 0);
});

dbTest("reconciliation: a failed or malformed page is never read as 'no payments'; duplicates and bad records are handled one by one", async () => {
    const base = epoch(41);
    const at = (minutes) => secondsOf(plus(base, minutes * 60 * 1000));
    const g = await initiated(bob, base, { variant: variants[1] });
    const h = await initiated(bob, base, { variant: variants[1] });
    await reservations.expireReservations({ now: plus(base, 1) });
    const pg = gatewayPayment(g.razorpayOrderId, { created_at: at(10) });
    const ph = gatewayPayment(h.razorpayOrderId, { created_at: at(5) });
    const stock = await stockOf(variants[1]);
    const now = plus(base, 60 * 60 * 1000);
    const state = async (o) => (await stored(o.id)).paymentStatus;

    try {
        // Page 2 fails: page 1's payment (newest, G) is settled; H is neither settled nor given up on.
        gateway.listFails = (page) => page === 1;
        const failed = await reconcile(now, { ...OWN_DAY, pageSize: 1 });
        assert.deepEqual([failed.complete, failed.stopped, failed.paid], [false, "fetch_failed", 1], JSON.stringify(failed));
        assert.deepEqual([await state(g), await state(h)], ["PAID", "UNPAID"]);
        gateway.listFails = null;

        // A malformed first page: nothing is decided from it.
        gateway.listRespond = (page, r) => (page === 0 ? { ...r, count: r.count + 1 } : r);
        const malformed = await reconcile(now, { ...OWN_DAY, pageSize: 1 });
        assert.deepEqual([malformed.complete, malformed.stopped, malformed.captured], [false, "malformed_page", 0]);
        assert.equal(await state(h), "UNPAID");

        // The page limit: what is left waits for the next run (and is logged).
        gateway.listRespond = null;
        const limited = await reconcile(now, { ...OWN_DAY, pageSize: 1, maxPages: 1 });
        assert.deepEqual([limited.complete, limited.stopped], [false, "page_limit"]);

        // Duplicates across pages and a malformed captured record: the rest is still settled once.
        gateway.listRespond = (page, r) => ({ ...r, count: r.count + 2, items: [...r.items, { ...pg }, { id: "pay_bad", status: "captured", order_id: h.razorpayOrderId }] });
        // Page size 5: the 2 real payments plus the 2 injected records still fit one page.
        const healed = await reconcile(now, { ...OWN_DAY, pageSize: 5 });
        assert.equal(healed.complete, true, JSON.stringify(healed));
        assert.ok(healed.duplicates >= 1 && healed.malformed >= 1, JSON.stringify(healed));
        assert.deepEqual([await state(g), await state(h)], ["PAID", "PAID"]);
        assert.equal((await stored(h.id)).razorpayPaymentId, ph.id);
    } finally {
        gateway.listFails = null;
        gateway.listRespond = null;
    }
    assert.equal(await stockOf(variants[1]), stock - 4, "each order's stock taken exactly once");

    // Without Razorpay keys the job does nothing (and says so).
    const saved = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_SECRET;
    try {
        const calls = gateway.listCalls;
        assert.equal((await reconcile(now)).stopped, "disabled");
        assert.equal(gateway.listCalls, calls);
    } finally {
        process.env.RAZORPAY_KEY_SECRET = saved;
    }
});

dbTest("reconciliation: a second captured payment on an order that already owes a refund is reconciled too", async () => {
    const saved = await stockOf(variants[1]);
    const base = epoch(42);
    const at = (minutes) => secondsOf(plus(base, minutes * 60 * 1000));
    try {
        const order = await initiated(bob, base, { variant: variants[1] });
        await reservations.expireReservations({ now: plus(base, 1) });
        await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: 1 } });

        const p1 = gatewayPayment(order.razorpayOrderId, { created_at: at(5) });
        assert.equal((await deliver(paymentEvent("payment.captured", p1))).body.outcome, "refused");

        // P2: still no stock -> also owed (the late-payment check skips this order now; reconciliation does not).
        const p2 = gatewayPayment(order.razorpayOrderId, { created_at: at(10) });
        const run = await reconcile(plus(base, 60 * 60 * 1000), OWN_DAY);
        assert.deepEqual([run.recorded_before, run.refused], [1, 1], JSON.stringify(run));
        assert.deepEqual((await unapplied(order.id)).map((r) => r.razorpayPaymentId).sort(), [p1.id, p2.id].sort());

        // P3 after a restock: a payment with no refund record may still reinstate the order.
        await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: 10 } });
        const p3 = gatewayPayment(order.razorpayOrderId, { created_at: at(15) });
        const later = await reconcile(plus(base, 2 * 60 * 60 * 1000), OWN_DAY);
        assert.equal(later.paid, 1, JSON.stringify(later));
        const row = await stored(order.id);
        assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["PENDING", "PAID", p3.id]);
        assert.equal(await stockOf(variants[1]), 8);
        const open = (await unapplied(order.id)).filter((r) => !r.refundedAt).map((r) => r.razorpayPaymentId).sort();
        assert.deepEqual(open, [p1.id, p2.id].sort(), "P1 and P2 are still owed back");
    } finally {
        await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: saved } });
    }
});

dbTest("reconciliation racing webhook deliveries settles the late payment once", async () => {
    const base = epoch(43);
    const order = await initiated(alice, base);
    await reservations.expireReservations({ now: plus(base, 1) });
    const payment = gatewayPayment(order.razorpayOrderId, { created_at: secondsOf(plus(base, 5 * 60 * 1000)) });
    const stock = await stockOf(variants[0]);
    const now = plus(base, 60 * 60 * 1000);

    await Promise.all([
        reconcile(now, OWN_DAY),
        deliver(paymentEvent("payment.captured", payment)),
        deliver(paymentEvent("order.paid", payment)),
        reconcile(now, OWN_DAY),
    ]);

    const row = await stored(order.id);
    assert.deepEqual([row.status, row.paymentStatus, row.razorpayPaymentId], ["PENDING", "PAID", payment.id]);
    assert.equal(await stockOf(variants[0]), stock - 2, "taken exactly once");
    assert.deepEqual(await unapplied(order.id), []);
});

// ------------------------------------------------------------ admin refund-due filter

dbTest("admin: ?refundDue lists exactly the orders with an open refund, with status and paging, admins only", async () => {
    const list = (query, user = admin) => fetch(`${server.url}/admin/orders?${query}`, { headers: user?.headers ?? {} })
        .then(async (r) => ({ status: r.status, body: await r.json() }));

    assert.equal((await list("refundDue=true", null)).status, 401);
    assert.equal((await list("refundDue=true", alice)).status, 403);
    for (const bad of ["refundDue=yes", "refundDue=1", "refundDue=true&refundDue=false"]) {
        assert.equal((await list(bad)).status, 422, bad);
    }

    // Two open refunds on one order still list it once; a refunded record does not count.
    const order = await initiated(alice, null);
    await orders.cancelOrder(alice.id, order.id);
    for (let i = 0; i < 2; i++) await deliver(paymentEvent("payment.captured", gatewayPayment(order.razorpayOrderId)));
    assert.equal((await unapplied(order.id)).length, 2);
    const settled = await initiated(alice, null);
    await orders.cancelOrder(alice.id, settled.id);
    const refunded = gatewayPayment(settled.razorpayOrderId);
    await deliver(paymentEvent("payment.captured", refunded));
    await deliver(refundEvent({ id: nextId("rfnd"), payment_id: refunded.id, amount: 4000, currency: "USD" }));

    const expected = await prisma.order.count({ where: { unappliedPayments: { some: { refundedAt: null } } } });
    const due = await list("refundDue=true&limit=100");
    assert.equal(due.status, 200);
    assert.equal(due.body.pagination.total, expected);
    assert.ok(due.body.data.every((o) => o.refundDue === true));
    assert.equal(due.body.data.filter((o) => o.id === order.id).length, 1, "listed once");
    assert.ok(!due.body.data.some((o) => o.id === settled.id), "refund confirmed: not due");
    assert.ok(!JSON.stringify(due.body).includes("razorpay"), "no gateway ids in the list");

    const notDue = await list("refundDue=false&limit=100");
    assert.ok(notDue.body.data.every((o) => o.refundDue === false));
    assert.equal(due.body.pagination.total + notDue.body.pagination.total, await prisma.order.count());

    // With a status filter, and paged one at a time without overlaps.
    const cancelledDue = await list("refundDue=true&status=CANCELLED&limit=100");
    assert.ok(cancelledDue.body.data.every((o) => o.status === "CANCELLED" && o.refundDue));
    assert.ok(cancelledDue.body.data.some((o) => o.id === order.id));
    if (due.body.pagination.total >= 2) {
        const [p1, p2] = await Promise.all([list("refundDue=true&limit=1&page=1"), list("refundDue=true&limit=1&page=2")]);
        assert.notEqual(p1.body.data[0].id, p2.body.data[0].id);
        assert.equal(p1.body.pagination.totalPages, due.body.pagination.total);
    }
});

// ------------------------------------------------------------ orders without a deadline

dbTest("missing deadline: an online order without one gets 30 minutes from now, is never cancelled on sight, then expires normally", async () => {
    const base = epoch(44);
    const stock = await stockOf(variants[0]);
    const legacy = await place(alice);
    await prisma.order.update({ where: { id: legacy.id }, data: { reservationExpiresAt: null } });
    const cod = await place(alice, { paymentMethod: "COD" });
    const paid = await initiated(alice, null);
    await verify(alice, paid, gatewayPayment(paid.razorpayOrderId));
    await prisma.order.update({ where: { id: paid.id }, data: { reservationExpiresAt: null } });

    const first = await reservations.expireReservations({ now: base });
    assert.ok(first.deadline_assigned >= 1);
    let row = await stored(legacy.id);
    assert.equal(row.status, "PENDING", "not cancelled on sight");
    assert.equal(row.reservationExpiresAt.getTime(), base.getTime() + 30 * 60 * 1000);

    // Idempotent: a rerun does not move the deadline.
    await reservations.expireReservations({ now: plus(base, 60 * 1000) });
    assert.equal((await stored(legacy.id)).reservationExpiresAt.getTime(), base.getTime() + 30 * 60 * 1000);

    // COD and paid orders never get one.
    assert.equal((await stored(cod.id)).reservationExpiresAt, null);
    assert.equal((await stored(paid.id)).reservationExpiresAt, null);

    // At the new deadline it expires by the normal rules, stock returned once.
    await reservations.expireReservations({ now: plus(base, 30 * 60 * 1000) });
    row = await stored(legacy.id);
    assert.equal(row.status, "CANCELLED");
    assert.equal(await stockOf(variants[0]), stock - 2 - 2, "legacy's stock back; COD and paid still hold theirs");

    await orders.cancelOrder(alice.id, cod.id);
});

// ------------------------------------------------------------ created-payment cutoff (RESERVATION_CREATED_CUTOFF)

const HOUR = 60 * 60 * 1000;

// Runs fn with RESERVATION_CREATED_CUTOFF set (undefined: unset, the 2h default).
async function withCutoff(value, fn) {
    const saved = process.env.RESERVATION_CREATED_CUTOFF;
    if (value === undefined) delete process.env.RESERVATION_CREATED_CUTOFF;
    else process.env.RESERVATION_CREATED_CUTOFF = value;
    try {
        return await fn();
    } finally {
        if (saved === undefined) delete process.env.RESERVATION_CREATED_CUTOFF;
        else process.env.RESERVATION_CREATED_CUTOFF = saved;
    }
}

dbTest("cutoff: a created payment keeps the stock until 2h past the deadline, then the order is released exactly once", async () => {
    await withCutoff(undefined, async () => {
        const deadline = epoch(50);
        const stock = await stockOf(variants[0]);
        const order = await initiated(alice, deadline);
        gatewayPayment(order.razorpayOrderId, { status: "failed" });
        gatewayPayment(order.razorpayOrderId, { status: "created", method: "upi" });

        // 1 ms before the cutoff: kept, still reserved.
        const before = await reservations.expireReservations({ now: plus(deadline, 2 * HOUR - 1) });
        assert.equal(before.cutoff_expired, 0);
        assert.equal((await stored(order.id)).status, "PENDING");
        assert.equal(await stockOf(variants[0]), stock - 2);

        // At the cutoff, several workers at once: released once.
        const now = plus(deadline, 2 * HOUR);
        const runs = await Promise.all([1, 2, 3, 4].map(() => reservations.expireReservations({ now })));
        assert.equal(runs.reduce((sum, c) => sum + c.cutoff_expired, 0), 1, JSON.stringify(runs));
        const row = await stored(order.id);
        assert.deepEqual([row.status, row.paymentStatus], ["CANCELLED", "UNPAID"]);
        assert.equal(row.expiredAt.getTime(), now.getTime());
        assert.equal(await stockOf(variants[0]), stock, "returned");

        // Repeated sweeps: never returned twice.
        for (let i = 1; i <= 3; i++) await reservations.expireReservations({ now: plus(now, i * 60 * 1000) });
        assert.equal(await stockOf(variants[0]), stock);
        assert.equal((await orders.getOrder(alice.id, order.id)).expired, true);
    });
});

dbTest("cutoff: the configured value is used (30m here) and read on every sweep", async () => {
    await withCutoff("30m", async () => {
        const deadline = epoch(51);
        const order = await initiated(alice, deadline);
        gatewayPayment(order.razorpayOrderId, { status: "created" });

        await reservations.expireReservations({ now: plus(deadline, 30 * 60 * 1000 - 1) });
        assert.equal((await stored(order.id)).status, "PENDING");
        const counts = await reservations.expireReservations({ now: plus(deadline, 30 * 60 * 1000) });
        assert.equal(counts.cutoff_expired, 1);
        assert.equal((await stored(order.id)).status, "CANCELLED");
    });
});

dbTest("cutoff: authorized, captured, unknown, incomplete, malformed or unreachable answers never trigger it", async () => {
    await withCutoff(undefined, async () => {
        const deadline = epoch(52);
        const now = plus(deadline, 23 * HOUR); // far past the 2h cutoff
        const make = async (...statuses) => {
            const order = await initiated(alice, deadline);
            for (const s of statuses) gatewayPayment(order.razorpayOrderId, typeof s === "string" ? { status: s } : s);
            return order;
        };
        const pending = async (order, label) => assert.equal((await stored(order.id)).status, "PENDING", label);

        // Payment sets that block the cutoff even though one payment is "created".
        const withAuthorized = await make("created", "authorized");
        const withWrongCapture = await make("created", { status: "captured", amount: 3999 });
        const withUnknown = await make("created", "pending_review");
        const blocked = await reservations.expireReservations({ now });
        assert.equal(blocked.cutoff_expired, 0);
        await pending(withAuthorized, "authorized");
        await pending(withWrongCapture, "a captured payment, even of the wrong amount");
        await pending(withUnknown, "an unrecognised status");
        assert.deepEqual((await unapplied(withWrongCapture.id)).map((r) => r.reason), ["amount_or_currency_mismatch"]);

        // A "created"-only order: kept while Razorpay's answer cannot be trusted.
        const isolated = await make("created");
        const stock = await stockOf(variants[0]);
        for (const [label, setup] of [
            ["incomplete list", () => { gateway.respond = (id, r) => (id === isolated.razorpayOrderId ? { ...r, count: r.count + 1 } : r); }],
            ["malformed list", () => { gateway.respond = (id, r) => (id === isolated.razorpayOrderId ? { entity: "collection", count: 1 } : r); }],
            ["Razorpay unreachable", () => { gateway.down = true; }],
        ]) {
            setup();
            let counts;
            try {
                counts = await reservations.expireReservations({ now: plus(now, 1000) });
            } finally {
                gateway.respond = null;
                gateway.down = false;
            }
            assert.equal(counts.cutoff_expired, 0, label);
            await pending(isolated, label);
            assert.equal(await stockOf(variants[0]), stock, `${label}: still reserved`);
        }

        // With a trustworthy answer the same order is released: the uncertainty was the reason.
        const trusted = await reservations.expireReservations({ now: plus(now, 2000) });
        assert.equal(trusted.cutoff_expired, 1);
        assert.equal((await stored(isolated.id)).status, "CANCELLED");
        assert.equal(await stockOf(variants[0]), stock + 2);

        // Tidy: resolve the blocked ones so later tests start clean.
        for (const o of [withAuthorized, withWrongCapture, withUnknown]) {
            for (const p of gatewayPayments.values()) if (p.order_id === o.razorpayOrderId && p.status !== "captured") p.status = "failed";
        }
        await reservations.expireReservations({ now: plus(now, 3000) });
    });
});

dbTest("cutoff: failed or refunded payments keep the normal expiry at the deadline; COD and paid orders are untouched", async () => {
    await withCutoff(undefined, async () => {
        const deadline = epoch(53);
        const failed = await initiated(alice, deadline);
        gatewayPayment(failed.razorpayOrderId, { status: "failed" });
        gatewayPayment(failed.razorpayOrderId, { status: "refunded" });
        const cod = await place(alice, { paymentMethod: "COD" });
        await setDeadline(cod.id, deadline);
        const paid = await initiated(alice, null);
        await verify(alice, paid, gatewayPayment(paid.razorpayOrderId));
        await setDeadline(paid.id, deadline);

        // Normal expiry, right at the deadline (no cutoff wait).
        const counts = await reservations.expireReservations({ now: deadline });
        assert.ok(counts.expired >= 1);
        assert.equal(counts.cutoff_expired, 0);
        assert.equal((await stored(failed.id)).status, "CANCELLED");

        // Far past any cutoff: COD and paid orders never change.
        await reservations.expireReservations({ now: plus(deadline, 30 * HOUR) });
        assert.deepEqual([(await stored(cod.id)).status, (await stored(cod.id)).paymentStatus], ["PENDING", "UNPAID"]);
        assert.deepEqual([(await stored(paid.id)).status, (await stored(paid.id)).paymentStatus], ["PENDING", "PAID"]);

        await orders.cancelOrder(alice.id, cod.id);
    });
});

dbTest("cutoff: a capture after the cutoff reinstates when stock is there; after resale it is owed back, and the record blocks reinstatement", async () => {
    const saved = await stockOf(variants[1]);
    try {
        await withCutoff(undefined, async () => {
            const deadline = epoch(54);
            const cutoff = plus(deadline, 2 * HOUR);

            // Stock still there: the late capture reinstates the order.
            const kept = await initiated(bob, deadline, { variant: variants[1] });
            const keptPayment = gatewayPayment(kept.razorpayOrderId, { status: "created" });
            await reservations.expireReservations({ now: cutoff });
            assert.equal((await stored(kept.id)).status, "CANCELLED");
            const stock = await stockOf(variants[1]);
            keptPayment.status = "captured";
            assert.equal((await deliver(paymentEvent("payment.captured", keptPayment))).body.outcome, "paid");
            assert.deepEqual([(await stored(kept.id)).status, (await stored(kept.id)).paymentStatus], ["PENDING", "PAID"]);
            assert.equal(await stockOf(variants[1]), stock - 2, "taken again exactly once");

            // Stock resold meanwhile: owed back, durably, and the order stays cancelled.
            const resold = await initiated(bob, plus(deadline, 1000), { variant: variants[1] });
            const resoldPayment = gatewayPayment(resold.razorpayOrderId, { status: "created", created_at: secondsOf(plus(deadline, 10 * 60 * 1000)) });
            await reservations.expireReservations({ now: plus(cutoff, 1000) });
            assert.equal((await stored(resold.id)).status, "CANCELLED");
            await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: 1 } });
            resoldPayment.status = "captured";
            assert.equal((await deliver(paymentEvent("payment.captured", resoldPayment))).body.outcome, "refused");
            await assertRefundStands(resold, resoldPayment, 1, "after resale");

            // Restocked later: the refund record still blocks reinstatement, on every path.
            await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: 50 } });
            await rejectsWith(verify(bob, resold, resoldPayment), 409, /refunded/);
            assert.equal((await deliver(paymentEvent("order.paid", resoldPayment))).body.outcome, "refused");
            const run = await payments.reconcileRecentPayments({ now: plus(cutoff, HOUR), windowMs: 6 * HOUR });
            assert.ok(run.recorded_before >= 1, JSON.stringify(run));
            assert.equal(run.paid, 0);
            await assertRefundStands(resold, resoldPayment, 50, "after restock");
        });
    } finally {
        await prisma.productVariant.update({ where: { id: variants[1].id }, data: { stock: saved } });
    }
});
