// Order lifecycle emails: which event sends which email, once only (repeats
// and lost races send nothing), payment gating for online orders, expiry,
// refunds from the refund.processed webhook, and email failures that must
// never affect the order operation.
//
// Emails are captured in this process with setOrderMailSender (no provider
// is called), except the masked-logging test, which uses the real sendMail
// with MAIL_PROVIDER=disabled. Razorpay is never called: the payment service
// uses a fake gateway.
//
// Fixtures: a category, a product, users with addresses and their orders,
// all created by this run and deleted in after(), in the test database named
// by TEST_DATABASE_URL (see testDatabase.js); unset, these tests are skipped.
import "dotenv/config";
import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { orderEmail, refundEmail, formatMoney, fromMinorUnits, verificationEmail } from "../services/mailTemplates.js";
import {
    openTestDatabase, testDatabaseGuardTest, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

const RUN = crypto.randomBytes(4).toString("hex");
const KEY_SECRET = `fake-key-secret-${crypto.randomBytes(12).toString("hex")}`;
const WEBHOOK_SECRET = `fake-webhook-secret-${crypto.randomBytes(12).toString("hex")}`;

process.env.RAZORPAY_KEY_ID = "rzp_test_OrderEmailsSuite";
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.CLIENT_URL = "https://shop.example.test";

const { guard, skip, prisma } = await openTestDatabase();
const orders = guard.ok ? await import("../services/orderService.js") : {};
const payments = guard.ok ? await import("../services/paymentService.js") : {};
const webhooks = guard.ok ? await import("../services/razorpayWebhookService.js") : {};
const emails = guard.ok ? await import("../services/orderEmailService.js") : {};
const notifications = guard.ok ? await import("../services/notificationService.js") : {};
const refunds = guard.ok ? await import("../services/refundService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const PRODUCT_NAME = `Tee <b>&</b> "Quote" ${RUN}`;
const created = { users: [], products: [], categories: [], gatewayOrders: [], eventKeys: [] };
let variant, sequence = 0;

// ------------------------------------------------------------ captured emails

let sent = [];
const capture = async (message, label) => {
    sent.push({ ...message, label });
    return true;
};

// Every queued email for this user, after all queued sends have settled.
async function mailTo(user) {
    await emails.flushOrderEmails();
    await refunds.flushRefundEmails();
    return sent.filter((m) => m.to === user.email);
}

const subjects = async (user) => (await mailTo(user)).map((m) => m.subject);

// ------------------------------------------------------------ fake Razorpay

const gatewayPayments = new Map();
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
        const items = [...gatewayPayments.values()].filter((p) => p.order_id === orderId);
        return { entity: "collection", count: items.length, items };
    },
    async listPayments() {
        return { entity: "collection", count: 0, items: [] };
    },
};

// 2 x 20.00 USD = 4000 cents, the total of every fixture order.
function capturedPayment(razorpayOrderId) {
    const payment = {
        id: nextId("pay"), entity: "payment", order_id: razorpayOrderId, amount: 4000, currency: "USD", status: "captured",
        created_at: Math.floor(Date.now() / 1000),
    };
    gatewayPayments.set(payment.id, payment);
    return payment;
}

const checkoutSignature = (orderId, paymentId) => crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

const verify = (user, order, payment) => payments.verifyPayment(user.id, order.id, {
    razorpayOrderId: order.razorpayOrderId, razorpayPaymentId: payment.id, razorpaySignature: checkoutSignature(order.razorpayOrderId, payment.id),
});

function refundEvent(refund) {
    return JSON.stringify({
        entity: "event", account_id: "acc_OrderEmailsSuite", event: "refund.processed", contains: ["refund", "payment"],
        payload: { refund: { entity: { entity: "refund", status: "processed", ...refund } } },
        created_at: 1700000000,
    });
}

const newEventId = () => {
    const id = `evt_${RUN}${String(++sequence).padStart(4, "0")}`;
    created.eventKeys.push(id);
    return id;
};

const handle = (body, eventId = newEventId()) => webhooks.handleWebhook(Buffer.from(body), {
    "x-razorpay-signature": crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex"),
    "x-razorpay-event-id": eventId,
});

// ------------------------------------------------------------ fixtures

async function makeUser(label) {
    const user = await prisma.user.create({
        data: { email: `order-emails-${label}-${RUN}@example.test`, passwordHash: "not-a-login", firstName: `Em<${label}>`, lastName: "Tester" },
    });
    created.users.push({ id: user.id, email: user.email });
    const address = await prisma.address.create({
        data: {
            userId: user.id, firstName: "Em", lastName: label, phone: "5550000000", address: "1 Mail <Rd>",
            city: "Austin", state: "TX", zipCode: "73301", country: "United States", isDefault: true,
        },
    });
    return { id: user.id, email: user.email, addressId: address.id };
}

// A real order through createOrder (stock is taken), 2 x 20.00 USD.
async function place(user, paymentMethod = "COD") {
    const cart = await prisma.cart.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    await prisma.cartItem.create({ data: { cartId: cart.id, variantId: variant.id, quantity: 2 } });
    return orders.createOrder(user.id, { addressId: user.addressId, paymentMethod });
}

// An online order with a gateway order.
async function placeOnline(user) {
    const order = await place(user, "RAZORPAY");
    const { razorpayOrderId } = await payments.initiatePayment(user.id, order.id);
    return { ...order, razorpayOrderId };
}

before(async () => {
    if (!guard.ok) return;

    await assertOnTestDatabase(prisma);

    payments.setPaymentGateway(fakeGateway);
    emails.setOrderMailSender(capture);

    const slug = `order-emails-${RUN}`;
    const category = await prisma.category.create({ data: { name: `Order emails ${RUN}`, slug } });
    created.categories.push({ id: category.id, slug });

    const product = await prisma.product.create({
        data: {
            categoryId: category.id, name: PRODUCT_NAME, slug: `order-emails-${RUN}`, price: "20.00", currency: "USD", isActive: true,
            variants: { create: [{ sku: `OEM-${RUN}`.toUpperCase(), size: "M", color: "Black", stock: 500 }] },
        },
        include: { variants: true },
    });
    created.products.push({ id: product.id, slug: product.slug });
    variant = { id: product.variants[0].id };
});

after(async () => {
    if (!guard.ok) return;

    try {
        await emails.flushOrderEmails();
        const userIds = created.users.map((u) => u.id);
        await deleteInTestDatabase(prisma, async (tx) => {
            await tx.razorpayWebhookEvent.deleteMany({
                where: { OR: [{ eventKey: { in: created.eventKeys } }, { razorpayOrderId: { in: created.gatewayOrders } }] },
            });
            await tx.razorpayRefund.deleteMany({ where: { order: { userId: { in: userIds } } } });
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
        emails.setOrderMailSender?.();
        await prisma.$disconnect();
    }
});

// ------------------------------------------------------------ templates (no database)

const sampleOrder = {
    firstName: "<Ana>", orderNumber: "ORD-<1>", currency: "USD",
    subtotal: "40.00", discount: "5.00", couponCode: "SAVE<5>", shipping: "0.00", tax: "0.00", total: "35.00",
    paymentReference: "pay_ABC", link: "https://shop.example.test/orders/7?x=<y>",
    items: [{ productName: "Tee <script>alert(1)</script>", size: "M", color: "Black & Red", quantity: 2, unitPrice: "20.00", lineTotal: "40.00" }],
    shippingAddress: { firstName: "Ana", lastName: "O'Neil", address: "1 <Main> St", apartment: null, city: "Austin", state: "TX", zipCode: "73301", country: "US" },
};

test("templates: every order email escapes user-controlled values in its HTML", () => {
    for (const kind of ["ORDER_CONFIRMED", "ORDER_PAID", "ORDER_SHIPPED", "ORDER_DELIVERED", "ORDER_CANCELLED", "ORDER_EXPIRED"]) {
        const { subject, text, html } = orderEmail(kind, sampleOrder);
        assert.ok(subject.includes("ORD-<1>"), `${kind}: order number in subject`);
        assert.ok(!html.includes("<script>"), `${kind}: product name escaped`);
        assert.ok(html.includes("Tee &lt;script&gt;alert(1)&lt;/script&gt;"), `${kind}: item shown`);
        assert.ok(!html.includes("<Ana>") && html.includes("&lt;Ana&gt;"), `${kind}: name escaped`);
        assert.ok(html.includes("$35.00") && html.includes("Total (USD)"), `${kind}: total and currency`);
        assert.ok(html.includes("Discount (SAVE&lt;5&gt;)"), `${kind}: coupon code escaped`);
        assert.ok(html.includes('href="https://shop.example.test/orders/7?x=&lt;y&gt;"'), `${kind}: link escaped`);
        assert.ok(text.includes("Tee <script>alert(1)</script>") && text.includes("Total (USD): $35.00"), `${kind}: text part is complete`);
    }
});

test("templates: status wording per kind", () => {
    assert.match(orderEmail("ORDER_CONFIRMED", sampleOrder).text, /Cash on delivery/);
    const paid = orderEmail("ORDER_PAID", sampleOrder);
    assert.equal(paid.subject, "Order confirmed — payment received (ORD-<1>)");
    assert.match(paid.text, /payment of \$35\.00/);
    assert.match(paid.text, /Payment reference pay_ABC/);
    assert.equal(orderEmail("ORDER_EXPIRED", sampleOrder).subject, "Order expired — payment not received (ORD-<1>)");
    assert.match(orderEmail("ORDER_CANCELLED", sampleOrder).text, /No payment was recorded/);
    assert.throws(() => orderEmail("ORDER_PROCESSING", sampleOrder), /unknown order email kind/);
});

test("templates: refund email shows exactly the refunded amount and currency given, in major units", () => {
    const { subject, text, html } = refundEmail({ firstName: "<Bo>", orderNumber: "ORD-9", amount: 123456, currency: "INR", refundId: "rfnd_X1", link: null });
    assert.equal(subject, "Refund processed for order ORD-9");
    assert.match(text, /refund of ₹1,234\.56/);
    assert.match(text, /Refund reference: rfnd_X1/);
    assert.ok(html.includes("&lt;Bo&gt;") && !html.includes("<Bo>"));
    assert.ok(!text.includes("View your order"), "no link when none is given");
    assert.equal(fromMinorUnits(4000, "USD"), 40);
    assert.equal(formatMoney(40, "USD"), "$40.00");
});

test("templates: the verification email still uses the same shell", () => {
    const { html } = verificationEmail({ firstName: "A", link: "https://x.test/v?token=1", lifetimeMs: 86_400_000 });
    assert.ok(html.startsWith("<!doctype html>") && html.includes("Verify Email") && html.endsWith("</html>"));
});

// ------------------------------------------------------------ rules (no writes)

dbTest("rules: which event sends which email, by payment method", () => {
    const kind = emails.emailKindFor;
    assert.equal(kind("COD", "ORDER_PLACED"), "ORDER_CONFIRMED");
    assert.equal(kind("RAZORPAY", "ORDER_PLACED"), null, "online orders are not confirmed before payment");
    assert.equal(kind("RAZORPAY", "PAYMENT_RECEIVED"), "ORDER_PAID");
    assert.equal(kind("COD", "PAYMENT_RECEIVED"), null);
    assert.equal(kind("COD", "ORDER_CONFIRMED"), null);
    assert.equal(kind("COD", "ORDER_PROCESSING"), null);
    assert.equal(kind("COD", "ORDER_SHIPPED"), "ORDER_SHIPPED");
    assert.equal(kind("RAZORPAY", "ORDER_DELIVERED"), "ORDER_DELIVERED");
    assert.equal(kind("COD", "ORDER_CANCELLED"), "ORDER_CANCELLED");
    assert.equal(kind("RAZORPAY", "ORDER_CANCELLED", "expired"), "ORDER_EXPIRED");
});

dbTest("rules: recipient is the order's email snapshot, else the account email", () => {
    const pick = emails.recipientFor;
    assert.equal(pick({ shippingEmail: "snap@example.test", user: { email: "acct@example.test" } }), "snap@example.test");
    assert.equal(pick({ shippingEmail: "not-an-email", user: { email: "acct@example.test" } }), "acct@example.test");
    assert.equal(pick({ shippingEmail: "a@b.test\r\nBcc: x@y.test", user: { email: "acct@example.test" } }), "acct@example.test");
    assert.equal(pick({ shippingEmail: "", user: { email: "nope" } }), null);
});

// ------------------------------------------------------------ COD

dbTest("COD: one confirmation email after the order is created, with items, totals, currency and link", async () => {
    const user = await makeUser("cod");
    const order = await place(user);

    const mail = await mailTo(user);
    assert.equal(mail.length, 1);
    const [m] = mail;
    assert.equal(m.subject, `Order confirmed — ${order.orderNumber}`);
    assert.match(m.text, /Cash on delivery/);
    assert.ok(m.text.includes(PRODUCT_NAME), "item name");
    assert.ok(m.text.includes("2 × $20.00 = $40.00"), "item quantity and prices");
    assert.ok(m.text.includes("Total (USD): $40.00"), "total and currency");
    assert.ok(m.text.includes(`https://shop.example.test/orders/${order.id}`), "order details link");
    assert.ok(!m.html.includes("<b>&</b>"), "product name escaped in HTML");
    assert.ok(m.html.includes("Em&lt;cod&gt;"), "first name escaped in HTML");
});

dbTest("COD: shipped and delivered send one email each; confirmed/processing send none; repeats send none", async () => {
    const user = await makeUser("fulfil");
    const order = await place(user);

    await orders.advanceOrderStatus(order.id, "CONFIRMED");
    await orders.advanceOrderStatus(order.id, "PROCESSING");
    assert.deepEqual(await subjects(user), [`Order confirmed — ${order.orderNumber}`], "no email for confirmed/processing");

    // Two admins mark it shipped at once: one wins, one email.
    const race = await Promise.allSettled([orders.advanceOrderStatus(order.id, "SHIPPED"), orders.advanceOrderStatus(order.id, "SHIPPED")]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    await assert.rejects(orders.advanceOrderStatus(order.id, "SHIPPED"), (err) => err.statusCode === 409);

    await orders.advanceOrderStatus(order.id, "DELIVERED");
    await assert.rejects(orders.advanceOrderStatus(order.id, "DELIVERED"), (err) => err.statusCode === 409);

    assert.deepEqual(await subjects(user), [
        `Order confirmed — ${order.orderNumber}`,
        `Your order ${order.orderNumber} has shipped`,
        `Your order ${order.orderNumber} has been delivered`,
    ]);
    const [, shipped] = await mailTo(user);
    assert.match(shipped.text, /Shipping to:\nEm fulfil\n1 Mail <Rd>/);
});

dbTest("customer cancellation: one email; a second or concurrent cancel sends none", async () => {
    const user = await makeUser("cancel");
    const order = await place(user);

    const race = await Promise.allSettled([orders.cancelOrder(user.id, order.id), orders.cancelOrder(user.id, order.id)]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    await assert.rejects(orders.cancelOrder(user.id, order.id), (err) => err.statusCode === 409);

    const mail = await mailTo(user);
    assert.deepEqual(mail.map((m) => m.subject), [`Order confirmed — ${order.orderNumber}`, `Your order ${order.orderNumber} has been cancelled`]);
    assert.match(mail[1].text, /cancelled as you requested/);
});

dbTest("recipient: an unusable email snapshot falls back to the account email", async () => {
    const user = await makeUser("fallback");
    const order = await place(user);
    await prisma.order.update({ where: { id: order.id }, data: { shippingEmail: "not-an-email" } });

    await orders.advanceOrderStatus(order.id, "CONFIRMED");
    await orders.advanceOrderStatus(order.id, "PROCESSING");
    await orders.advanceOrderStatus(order.id, "SHIPPED");

    const mail = await mailTo(user);
    assert.equal(mail.length, 2, "confirmation (snapshot) and shipped (fallback) both reach the account address");
    assert.equal(sent.filter((m) => m.to === "not-an-email").length, 0);
});

dbTest("dedupeKey: the same event reported twice (e.g. two code paths) creates one notification and sends one email", async () => {
    const user = await makeUser("dedupe");
    const order = await place(user);
    const owner = { id: order.id, userId: user.id, orderNumber: order.orderNumber };

    await Promise.all([notifications.notifyOrderEvent(owner, "ORDER_SHIPPED"), notifications.notifyOrderEvent(owner, "ORDER_SHIPPED")]);
    await notifications.notifyOrderEvent(owner, "ORDER_SHIPPED");

    assert.equal(await prisma.notification.count({ where: { orderId: order.id, type: "ORDER_SHIPPED" } }), 1);
    assert.deepEqual(await subjects(user), [`Order confirmed — ${order.orderNumber}`, `Your order ${order.orderNumber} has shipped`]);
});

// ------------------------------------------------------------ Razorpay

dbTest("Razorpay: nothing at placement; one combined email after verified payment; repeated and concurrent verification send none", async () => {
    const user = await makeUser("online");
    const order = await placeOnline(user);
    assert.deepEqual(await mailTo(user), [], "no confirmation before payment");

    const payment = capturedPayment(order.razorpayOrderId);
    const race = await Promise.allSettled([verify(user, order, payment), verify(user, order, payment)]);
    assert.ok(race.every((r) => r.status === "fulfilled"), "both verifications report the order paid");
    await verify(user, order, payment);
    await payments.refreshPayment(user.id, order.id);

    const mail = await mailTo(user);
    assert.equal(mail.length, 1, "exactly one email");
    assert.equal(mail[0].subject, `Order confirmed — payment received (${order.orderNumber})`);
    assert.ok(mail[0].text.includes(`Payment reference ${payment.id}`));
    assert.ok(mail[0].text.includes("Total (USD): $40.00"));
});

dbTest("Razorpay: an unpaid order that expires gets one 'payment not received' email; a repeat sends none; a late payment then confirms it", async () => {
    const user = await makeUser("expiry");
    const order = await placeOnline(user);
    const deadline = new Date(Date.UTC(2001, 5, 1));
    await prisma.order.update({ where: { id: order.id }, data: { reservationExpiresAt: deadline } });

    assert.equal(await orders.expireOrder(order.id, new Date(deadline.getTime() + 1000)), true);
    assert.equal(await orders.expireOrder(order.id, new Date(deadline.getTime() + 2000)), false);

    let mail = await mailTo(user);
    assert.deepEqual(mail.map((m) => m.subject), [`Order expired — payment not received (${order.orderNumber})`]);
    assert.ok(!/cancelled as you requested/.test(mail[0].text), "not worded as a customer cancellation");

    // A payment that arrives after expiry reinstates the order (stock is there).
    const payment = capturedPayment(order.razorpayOrderId);
    await verify(user, order, payment);

    mail = await mailTo(user);
    assert.deepEqual(mail.map((m) => m.subject), [
        `Order expired — payment not received (${order.orderNumber})`,
        `Order confirmed — payment received (${order.orderNumber})`,
    ]);
});

// ------------------------------------------------------------ refunds

dbTest("refund.processed: one email per refund id with its own amount and the running total; replays send none", async () => {
    const user = await makeUser("refund");
    const order = await placeOnline(user);
    const paymentId = nextId("pay");
    await prisma.unappliedPayment.create({
        data: { orderId: order.id, razorpayPaymentId: paymentId, razorpayOrderId: order.razorpayOrderId, amount: 4000, currency: "USD", reason: "order_already_paid" },
    });

    // A partial refund: stored, counted and emailed (still owed: not refunded yet).
    const firstId = nextId("rfnd");
    assert.equal((await handle(refundEvent({ id: firstId, payment_id: paymentId, amount: 1000, currency: "USD" }))).outcome, "unapplied_refund_partial");
    assert.equal((await prisma.unappliedPayment.findUnique({ where: { razorpayPaymentId: paymentId } })).refundedAt, null);

    // The rest: the payment is now refunded in full.
    const refundId = nextId("rfnd");
    const body = refundEvent({ id: refundId, payment_id: paymentId, amount: 3000, currency: "USD" });
    const eventId = newEventId();
    assert.equal((await handle(body, eventId)).outcome, "unapplied_refunded");
    assert.equal((await handle(body, eventId)).status, "duplicate", "same event replayed");
    assert.equal((await handle(body)).outcome, "unapplied_refund_full", "same refund under a new event id: stored once");
    assert.equal(await prisma.razorpayRefund.count({ where: { razorpayPaymentId: paymentId } }), 2);

    const mail = await mailTo(user);
    assert.equal(mail.length, 2, "one email per refund id");
    for (const m of mail) assert.equal(m.subject, `Refund processed for order ${order.orderNumber}`);
    assert.match(mail[0].text, /refund of \$10\.00/);
    assert.ok(mail[0].text.includes(`Refund reference: ${firstId}`));
    assert.match(mail[0].text, /Refunded so far: \$10\.00 of \$40\.00 paid/);
    assert.match(mail[1].text, /refund of \$30\.00/);
    assert.ok(mail[1].text.includes(`Refund reference: ${refundId}`));
    assert.match(mail[1].text, /has now been refunded in full/);
    assert.ok(mail[0].messageId?.startsWith(`<refund.${firstId}@`), "fixed Message-ID per refund");
});

// ------------------------------------------------------------ refund email outbox

// A settled refund of this order, due for its email now.
async function dueRefund(order, amount = 1000) {
    const now = new Date();
    return prisma.razorpayRefund.create({
        data: {
            razorpayRefundId: nextId("rfnd"), razorpayPaymentId: nextId("pay"), amount, currency: "USD",
            settledAt: now, orderId: order.id, emailDueAt: now,
        },
    });
}

const outboxRow = (refund) => prisma.razorpayRefund.findUnique({ where: { id: refund.id } });

dbTest("outbox: a failed send is retried after a backoff until accepted, then never sent again", async () => {
    const user = await makeUser("outbox-retry");
    const refund = await dueRefund(await place(user));
    const errors = mock.method(console, "error", () => {});

    try {
        emails.setOrderMailSender(async () => false);
        assert.equal((await refunds.deliverDueRefundEmails({ ids: [refund.id] })).failed, 1);
    } finally {
        emails.setOrderMailSender(capture);
        errors.mock.restore();
    }

    let row = await outboxRow(refund);
    assert.equal(row.emailSentAt, null);
    assert.equal(row.emailAttempts, 1);
    assert.equal(row.emailLastError, "SEND_FAILED");
    assert.ok(row.emailDueAt > new Date(), "due again later, not immediately");
    assert.equal((await refunds.deliverDueRefundEmails({ ids: [refund.id] })).sent, 0, "not before its backoff");

    const later = () => new Date(Date.now() + 2 * 60 * 60 * 1000);
    assert.equal((await refunds.deliverDueRefundEmails({ ids: [refund.id], now: later })).sent, 1);
    row = await outboxRow(refund);
    assert.ok(row.emailSentAt);
    assert.equal(row.emailAttempts, 2);

    assert.equal((await refunds.deliverDueRefundEmails({ ids: [refund.id], now: later })).sent, 0);
    assert.equal((await mailTo(user)).filter((m) => m.label === "refund processed").length, 1);
});

dbTest("outbox: concurrent senders claim a refund once; a claim abandoned by a crash is retried with the same Message-ID", async () => {
    const user = await makeUser("outbox-claim");
    const refund = await dueRefund(await place(user));

    const results = await Promise.all([1, 2, 3].map(() => refunds.deliverDueRefundEmails({ ids: [refund.id] })));
    assert.equal(results.reduce((n, r) => n + r.sent, 0), 1, "sent by exactly one sender");
    const first = (await mailTo(user)).filter((m) => m.label === "refund processed");
    assert.equal(first.length, 1);

    // A sender that claimed the row and died before recording the result
    // (simulated: claimed, not sent). Nobody else sends it until the claim expires.
    const crashed = await dueRefund(await place(user));
    await prisma.razorpayRefund.update({ where: { id: crashed.id }, data: { emailLockedUntil: new Date(Date.now() + refunds.EMAIL_CLAIM_MS), emailAttempts: 1 } });
    assert.equal((await refunds.deliverDueRefundEmails({ ids: [crashed.id] })).sent, 0, "claimed elsewhere");
    const afterClaim = () => new Date(Date.now() + refunds.EMAIL_CLAIM_MS + 1000);
    assert.equal((await refunds.deliverDueRefundEmails({ ids: [crashed.id], now: afterClaim })).sent, 1, "retried once the claim expired");

    const mail = (await mailTo(user)).filter((m) => m.label === "refund processed");
    const crashedRow = await outboxRow(crashed);
    // The host is MAIL_FROM's domain (or CLIENT_URL's); the refund id makes it fixed per refund.
    assert.match(mail.at(-1).messageId, new RegExp(`^<refund\\.${crashedRow.razorpayRefundId}@[A-Za-z0-9.-]+>$`), "Message-ID fixed per refund");
});

dbTest("outbox: gives up after the maximum attempts and records why", async () => {
    const user = await makeUser("outbox-giveup");
    const refund = await dueRefund(await place(user));
    await prisma.razorpayRefund.update({ where: { id: refund.id }, data: { emailAttempts: refunds.EMAIL_MAX_ATTEMPTS - 1 } });
    const errors = mock.method(console, "error", () => {});

    try {
        emails.setOrderMailSender(async () => false);
        assert.equal((await refunds.deliverDueRefundEmails({ ids: [refund.id] })).gave_up, 1);
    } finally {
        emails.setOrderMailSender(capture);
        errors.mock.restore();
    }

    const row = await outboxRow(refund);
    assert.equal(row.emailLastError, "GAVE_UP");
    assert.equal(row.emailDueAt, null);
    assert.equal(row.emailSentAt, null);
});

dbTest("outbox: an error preparing one refund's email is a failed attempt; the rest of the batch is still sent; it gives up in the end", async () => {
    const user = await makeUser("outbox-prepare");
    const errors = mock.method(console, "error", () => {});

    try {
        // A refund whose totals cannot be worked out (its order's currency
        // has no minor-unit rule): refundEmailTotals throws.
        const badOrder = await place(user);
        const bad = await dueRefund(badOrder);
        await prisma.order.update({ where: { id: badOrder.id }, data: { razorpayPaymentId: bad.razorpayPaymentId, currency: "EUR" } });
        await prisma.razorpayRefund.update({ where: { id: bad.id }, data: { emailDueAt: new Date(Date.now() - 60_000) } });
        const good = await dueRefund(await place(user));

        const counts = await refunds.deliverDueRefundEmails({ ids: [bad.id, good.id] });
        assert.equal(counts.failed, 1);
        assert.equal(counts.sent, 1, "the bad refund (first in the batch) does not stop the next one");
        assert.ok((await outboxRow(good)).emailSentAt);

        let row = await outboxRow(bad);
        assert.equal(row.emailLastError, "PREPARE_FAILED");
        assert.equal(row.emailAttempts, 1);
        assert.equal(row.emailLockedUntil, null, "released, not left claimed");
        assert.ok(row.emailDueAt > new Date(), "retried after the backoff");

        // It counts towards exhaustion like any failure.
        await prisma.razorpayRefund.update({ where: { id: bad.id }, data: { emailAttempts: refunds.EMAIL_MAX_ATTEMPTS - 1, emailDueAt: new Date() } });
        assert.equal((await refunds.deliverDueRefundEmails({ ids: [bad.id] })).gave_up, 1);
        row = await outboxRow(bad);
        assert.equal(row.emailLastError, "GAVE_UP");
        assert.equal(row.emailDueAt, null);
    } finally {
        errors.mock.restore();
    }
});

// A mail sender whose first call waits until released (with the given
// answer); every later call is accepted at once. Records every call.
function gatedSender() {
    const calls = [];
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let started;
    const firstStarted = new Promise((resolve) => { started = resolve; });

    const sender = async (message) => {
        calls.push(message);
        if (calls.length === 1) {
            started();
            return gate;
        }
        return true;
    };

    return { sender, calls, firstStarted, finishFirst: (answer) => release(answer) };
}

// A sender (A) that outlives its claim; a second sender (B) takes the row
// over and sends; then A finishes with `lateAnswer`.
async function outlivedClaim(label, lateAnswer) {
    const user = await makeUser(label);
    const refund = await dueRefund(await place(user));
    const gated = gatedSender();
    const warnings = mock.method(console, "warn", () => {});

    try {
        emails.setOrderMailSender(gated.sender);

        // A: claims now; its send hangs (no timeout within this test).
        const a = refunds.deliverDueRefundEmails({ ids: [refund.id], sendTimeoutMs: 10 * 60 * 1000 });
        await gated.firstStarted;

        // B: runs after A's claim expired, takes ownership and sends.
        const afterClaim = () => new Date(Date.now() + refunds.EMAIL_CLAIM_MS + 1000);
        const b = await refunds.deliverDueRefundEmails({ ids: [refund.id], now: afterClaim });
        assert.equal(b.sent, 1, "the new owner sends");
        const byB = await outboxRow(refund);
        assert.ok(byB.emailSentAt);

        // A finishes late.
        gated.finishFirst(lateAnswer);
        const late = await a;
        assert.equal(late.lost_claim, 1, "the late sender knows it lost the claim");

        const final = await outboxRow(refund);
        assert.equal(final.emailSentAt.getTime(), byB.emailSentAt.getTime(), "B's recorded send is never overwritten");
        assert.equal(final.emailLastError, byB.emailLastError, "no error written over B's result");
        assert.equal(final.emailDueAt?.getTime(), byB.emailDueAt?.getTime());
        assert.equal(final.emailLockedUntil, null);
        assert.equal(final.emailAttempts, 2);
        assert.ok(warnings.mock.calls.some((c) => String(c.arguments[0]).includes("refund_email_claim_lost")), "lost claim logged");

        // Sent: no later run sends it again.
        assert.equal((await refunds.deliverDueRefundEmails({ ids: [refund.id], now: () => new Date(Date.now() + 24 * 60 * 60 * 1000) })).sent, 0);
        return gated.calls.length;
    } finally {
        emails.setOrderMailSender(capture);
        warnings.mock.restore();
    }
}

dbTest("outbox fencing: a sender that outlives its claim and then fails cannot overwrite the new owner's result", async () => {
    const errors = mock.method(console, "error", () => {});
    try {
        assert.equal(await outlivedClaim("fence-fail", false), 2);
    } finally {
        errors.mock.restore();
    }
});

dbTest("outbox fencing: a sender that outlives its claim and then succeeds keeps the first recorded send", async () => {
    assert.equal(await outlivedClaim("fence-sent", true), 2);
});

dbTest("outbox: an attempt is cut off by the send timeout and retried; a send accepted after it is still recorded once", async () => {
    const user = await makeUser("outbox-timeout");
    const refund = await dueRefund(await place(user));
    const gated = gatedSender();
    const errors = mock.method(console, "error", () => {});
    const warnings = mock.method(console, "warn", () => {});

    try {
        emails.setOrderMailSender(gated.sender);

        const counts = await refunds.deliverDueRefundEmails({ ids: [refund.id], sendTimeoutMs: 50 });
        assert.equal(counts.failed, 1);
        let row = await outboxRow(refund);
        assert.equal(row.emailLastError, "SEND_TIMEOUT");
        assert.equal(row.emailLockedUntil, null, "claim released for the retry");
        assert.ok(row.emailDueAt > new Date(), "retried after the backoff");
        assert.equal(row.emailSentAt, null);
        assert.ok(refunds.EMAIL_SEND_TIMEOUT_MS < refunds.EMAIL_CLAIM_MS, "the timeout ends an attempt inside its claim");

        // The provider accepts the timed-out send after all: recorded, so
        // the scheduled retry does not send it again.
        gated.finishFirst(true);
        await refunds.flushRefundEmails();
        row = await outboxRow(refund);
        assert.ok(row.emailSentAt, "late acceptance recorded");
        assert.equal((await refunds.deliverDueRefundEmails({ ids: [refund.id], now: () => new Date(Date.now() + 24 * 60 * 60 * 1000) })).sent, 0);
        assert.equal(gated.calls.length, 1, "sent once");
    } finally {
        emails.setOrderMailSender(capture);
        errors.mock.restore();
        warnings.mock.restore();
    }
});

// ------------------------------------------------------------ failures

dbTest("failures: a sender that throws or never answers does not delay or break placement, payment, cancellation or webhooks", async () => {
    const user = await makeUser("failing");
    const errors = mock.method(console, "error", () => {});
    let release;
    const hanging = new Promise((resolve) => { release = resolve; });

    try {
        emails.setOrderMailSender(async () => { throw new Error("SMTP exploded"); });
        const cod = await place(user);
        await orders.cancelOrder(user.id, cod.id);
        await emails.flushOrderEmails();
        const logged = errors.mock.calls.map((c) => String(c.arguments[0])).filter((line) => line.includes("SMTP exploded"));
        assert.equal(logged.length, 2, "both failures logged");
        assert.ok(logged.every((line) => !line.includes(user.email) && line.includes("o***@example.test")), "address masked in the log");

        // A send that never settles: every operation still returns promptly.
        emails.setOrderMailSender(() => hanging);
        const started = Date.now();
        const online = await placeOnline(user);
        await verify(user, online, capturedPayment(online.razorpayOrderId));
        const second = await place(user);
        await orders.cancelOrder(user.id, second.id);
        assert.ok(Date.now() - started < 10_000, "no operation waited for the email");

        const stored = await prisma.order.findMany({ where: { userId: user.id }, select: { status: true, paymentStatus: true }, orderBy: { id: "asc" } });
        assert.deepEqual(stored.map((o) => `${o.status}/${o.paymentStatus}`), ["CANCELLED/UNPAID", "PENDING/PAID", "CANCELLED/UNPAID"]);
    } finally {
        release(false);
        await emails.flushOrderEmails();
        errors.mock.restore();
        emails.setOrderMailSender(capture);
    }
});

dbTest("failures: the real mail service reports a refused send with a masked address and the order still succeeds", async () => {
    const user = await makeUser("disabled");
    const errors = mock.method(console, "error", () => {});
    const provider = process.env.MAIL_PROVIDER;

    try {
        process.env.MAIL_PROVIDER = "disabled";
        emails.setOrderMailSender();
        const order = await place(user);
        assert.equal(order.status, "PENDING");
        await emails.flushOrderEmails();

        const logged = errors.mock.calls.map((c) => String(c.arguments[0])).filter((line) => line.includes("order ORDER_CONFIRMED email"));
        assert.equal(logged.length, 1);
        assert.ok(!logged[0].includes(user.email) && logged[0].includes("o***@example.test"));
    } finally {
        process.env.MAIL_PROVIDER = provider;
        errors.mock.restore();
        emails.setOrderMailSender(capture);
    }
});
