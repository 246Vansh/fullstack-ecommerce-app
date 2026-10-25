import crypto from "node:crypto";
import Razorpay from "razorpay";
import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import {
    cancelOrder, getOrder, reinstateExpiredOrder, reservationEnded, UNPAID_PAYMENT_STATUSES, LATE_PAYMENT_STOCK_UNAVAILABLE,
} from "./orderService.js";

/*
|--------------------------------------------------------------------------
| Razorpay online payment
|--------------------------------------------------------------------------
| 1. initiatePayment: for the customer's own PENDING, unpaid RAZORPAY order,
|    create one Razorpay order for the stored total (in minor units) and keep
|    its id on the order. A retry reuses it, so a customer can never be
|    charged against two gateway orders for one order.
| 2. verifyPayment: after Razorpay Checkout returns, check the signature
|    (HMAC-SHA256 of "order_id|payment_id" with the key secret, compared in
|    constant time), then fetch the payment from Razorpay itself and mark the
|    order PAID only if that payment is captured, belongs to the stored
|    gateway order, and has the stored amount and currency.
| 3. refreshPayment: the same server-side check without browser data (lists
|    the gateway order's payments), for a closed tab or an uncertain result.
|
| 4. The Razorpay webhook (razorpayWebhookService) and the reservation expiry
|    worker (reservationService) apply payments through the same
|    applyPayment() as 2 and 3, so every path follows one set of rules.
|
| Marking PAID is one conditional UPDATE (still PENDING, still unpaid, same
| gateway order), so repeated or concurrent verifications settle once and
| later ones return the same result. A failed attempt leaves the order UNPAID:
| the customer can retry, or cancel it (which restores stock).
|
| Online orders hold their stock for 30 minutes (orderService). A new payment
| cannot be started after that, but a payment captured after it is still
| applied: before the order has expired, as usual; after it has expired, by
| reinstating the order if every item can be taken from stock again. Captured
| money that cannot be applied is recorded in unapplied_payments for a manual
| refund (and logged); no refund is ever issued or assumed here.
|
| Nothing here logs the key secret, signatures or payment details; failures
| log the order number and the gateway's status code only.
*/

// Minor units per major unit for the currencies accepted online.
const CURRENCY_EXPONENTS = { INR: 2, USD: 2 };

const PAYABLE_PAYMENT_STATUSES = UNPAID_PAYMENT_STATUSES;

const keyId = () => String(process.env.RAZORPAY_KEY_ID ?? "").trim();
const keySecret = () => String(process.env.RAZORPAY_KEY_SECRET ?? "").trim();

// Both keys are required (config/env.js refuses only one of them).
export const isOnlinePaymentEnabled = () => Boolean(keyId() && keySecret());

// The three gateway calls this service makes. setPaymentGateway() is a test
// seam (like hooks.afterStep in orderService); the app never calls it.
let gateway = null;

function razorpayGateway() {
    const client = new Razorpay({ key_id: keyId(), key_secret: keySecret() });

    return {
        createOrder: (params) => client.orders.create(params),
        fetchPayment: (paymentId) => client.payments.fetch(paymentId),
        fetchOrderPayments: (orderId) => client.orders.fetchPayments(orderId),
        // GET /payments: { from, to } in Unix seconds, count (max 100), skip.
        listPayments: (params) => client.payments.all(params),
    };
}

export function setPaymentGateway(next) {
    gateway = next;
}

const getGateway = () => (gateway ??= razorpayGateway());

// The client-visible code for an order total Razorpay refuses outright.
export const PAYMENT_AMOUNT_LIMIT = "PAYMENT_AMOUNT_LIMIT";

// Razorpay refused to create the gateway order because the amount is above the
// account's maximum. The same amount fails every time, so it is not retryable.
function isAmountLimitRejection(operation, err) {
    return operation === "order create"
        && err?.statusCode === 400
        && err?.error?.code === "BAD_REQUEST_ERROR"
        && /^amount exceeds maximum amount allowed\.?$/i.test(String(err.error.description ?? "").trim());
}

// Gateway errors become one generic 502 (except an amount-limit rejection: 422);
// the log keeps only the HTTP status and Razorpay's error code (never the
// request, response body or keys).
async function callGateway(operation, orderNumber, fn) {
    try {
        return await fn(getGateway());
    } catch (err) {
        const status = Number.isInteger(err?.statusCode) ? err.statusCode : "network";
        const code = /^[A-Z_]{1,64}$/.test(err?.error?.code ?? "") ? err.error.code : "unknown";
        console.error(`Razorpay ${operation} failed for order ${orderNumber}: ${status} ${code}`);
        if (process.env.NODE_ENV !== "production") {
            // Development only: Razorpay's own validation text, allow-listed.
            const clean = (v) => (typeof v === "string" ? v.replace(/[\r\n\t]/g, " ").slice(0, 200) : undefined);
            const { description, field, reason, source, step } = err?.error ?? {};
            console.error(`Razorpay ${operation} detail for order ${orderNumber}: ${JSON.stringify({
                description: clean(description), field: clean(field), reason: clean(reason), source: clean(source), step: clean(step),
            })}`);
        }
        if (isAmountLimitRejection(operation, err)) {
            throw new ApiError(422, "This order's total is above the online payment limit, so it can't be paid online. You can cancel the order instead.",
                [{ field: "amount", code: PAYMENT_AMOUNT_LIMIT, message: "Above the online payment limit" }]);
        }
        throw new ApiError(502, "The payment provider could not be reached. Please try again.");
    }
}

// The stored Decimal total in the currency's minor units (paise, cents).
export function toMinorUnits(total, currency) {
    const exponent = CURRENCY_EXPONENTS[currency];

    if (exponent === undefined) {
        throw new ApiError(422, `Online payment is not available for ${currency} orders`);
    }

    const minor = new Prisma.Decimal(total).mul(10 ** exponent);

    if (!minor.isInteger() || minor.lte(0)) {
        throw new ApiError(422, "This order total cannot be paid online");
    }

    return minor.toNumber();
}

// Razorpay's documented check: hex HMAC-SHA256 of "order_id|payment_id" with
// the key secret. Compared as bytes in constant time; anything that is not
// 64 hex characters is rejected without comparing.
export function isValidSignature(razorpayOrderId, razorpayPaymentId, signature, secret = keySecret()) {
    if (!secret || typeof signature !== "string" || !/^[0-9a-f]{64}$/i.test(signature)) return false;

    const expected = crypto.createHmac("sha256", secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest();
    const given = Buffer.from(signature, "hex");

    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const paymentSelect = {
    id: true,
    userId: true,
    orderNumber: true,
    status: true,
    paymentStatus: true,
    paymentMethod: true,
    total: true,
    currency: true,
    razorpayOrderId: true,
    razorpayPaymentId: true,
    shippingFirstName: true,
    shippingLastName: true,
    shippingEmail: true,
    shippingPhone: true,
    reservationExpiresAt: true,
    expiredAt: true,
};

// Only the owner's order: another user's id behaves exactly like a missing one.
async function loadOwnOrder(userId, id) {
    const order = await prisma.order.findFirst({ where: { id, userId }, select: paymentSelect });

    if (!order) throw new ApiError(404, "Order not found");

    return order;
}

const loadOrder = (id) => prisma.order.findUnique({ where: { id }, select: paymentSelect });

// The order a Razorpay gateway order belongs to (razorpayOrderId is unique), or null.
export const loadOrderByGatewayOrder = (razorpayOrderId) => prisma.order.findUnique({ where: { razorpayOrderId }, select: paymentSelect });

// Cancelled by the expiry worker and still unpaid: a payment for it arrived late.
const isExpiredUnpaid = (order) => order.status === "CANCELLED" && order.expiredAt != null
    && PAYABLE_PAYMENT_STATUSES.includes(order.paymentStatus);

function assertOnlineOrder(order) {
    if (order.paymentMethod !== "RAZORPAY") {
        throw new ApiError(409, "This order is not paid online");
    }
}

function assertPayable(order) {
    assertOnlineOrder(order);

    if (order.paymentStatus === "PAID") throw new ApiError(409, "This order has already been paid");

    if (order.status !== "PENDING" || !PAYABLE_PAYMENT_STATUSES.includes(order.paymentStatus)) {
        throw new ApiError(409, `This order is ${order.status.toLowerCase()} and can no longer be paid`);
    }

    // No new payment once the reservation has run out (the worker cancels the order).
    if (reservationEnded(order)) {
        throw new ApiError(409, "The time to pay for this order has run out, so its items have been released. Please place a new order.");
    }
}

// Whole seconds left to pay, for Razorpay Checkout's timeout; null without a deadline.
const secondsRemaining = (order, now = Date.now()) => (order.reservationExpiresAt
    ? Math.max(0, Math.floor((order.reservationExpiresAt.getTime() - now) / 1000))
    : null);

function assertEnabled() {
    if (!isOnlinePaymentEnabled()) throw new ApiError(503, "Online payment is not available right now");
}

// { state, order }: PAID, PROCESSING (authorized, not yet captured), FAILED
// (the last attempt failed; the order can be paid again) or UNPAID.
const result = async (state, userId, id) => ({ state, order: await getOrder(userId, id) });

// What the checkout needs to open Razorpay for this order. The amount is the
// stored total; nothing the browser sends is used.
export async function initiatePayment(userId, id) {
    assertEnabled();

    let order = await loadOwnOrder(userId, id);
    assertPayable(order);

    const amount = toMinorUnits(order.total, order.currency);

    if (!order.razorpayOrderId) {
        const created = await callGateway("order create", order.orderNumber, (g) => g.createOrder({
            amount,
            currency: order.currency,
            receipt: order.orderNumber,
            notes: { orderNumber: order.orderNumber },
        }));

        if (!created?.id || created.amount !== amount || created.currency !== order.currency) {
            console.error(`Razorpay order create returned an unexpected order for ${order.orderNumber}`);
            throw new ApiError(502, "The payment provider could not be reached. Please try again.");
        }

        // First initiation wins; a concurrent one reuses the stored gateway order
        // (its own gateway order is left unused and is never paid).
        await prisma.order.updateMany({
            where: { id, userId, razorpayOrderId: null, status: "PENDING", paymentStatus: { in: PAYABLE_PAYMENT_STATUSES } },
            data: { razorpayOrderId: created.id },
        });

        order = await loadOwnOrder(userId, id);
        assertPayable(order);

        if (!order.razorpayOrderId) throw new ApiError(409, "This order can no longer be paid");
    }

    return {
        keyId: keyId(),
        razorpayOrderId: order.razorpayOrderId,
        amount,
        currency: order.currency,
        orderNumber: order.orderNumber,
        // Checkout closes when the reservation ends (the server stays the authority).
        secondsRemaining: secondsRemaining(order),
        prefill: {
            name: `${order.shippingFirstName} ${order.shippingLastName}`.trim(),
            email: order.shippingEmail,
            contact: order.shippingPhone,
        },
    };
}


// Captured (or authorized, so about to be captured) money that cannot be
// applied to the order: someone must refund it in the Razorpay dashboard. One
// JSON line with the order number, gateway ids in Razorpay's own formats and
// the payment status only; never amounts, card or contact details, keys or
// signatures.
const SAFE_GATEWAY_ID = /^(order|pay)_[A-Za-z0-9]{1,40}$/;
const SAFE_STATUS = /^[a-z_]{1,20}$/;
const safe = (value, pattern) => (typeof value === "string" && pattern.test(value) ? value : null);

//
// A captured payment is also recorded in unapplied_payments (one row per
// payment, however often it is reported) so it stays visible to admins until
// Razorpay confirms its refund. An authorized payment is only logged: Razorpay
// releases it unless it is captured, and if it is captured it is reported again.
function logRefundRequired(order, payment, reason) {
    console.error(`Razorpay refund required ${JSON.stringify({
        event: "razorpay_refund_required",
        reason,
        orderNumber: order.orderNumber,
        razorpayOrderId: safe(order.razorpayOrderId, SAFE_GATEWAY_ID),
        razorpayPaymentId: safe(payment?.id, SAFE_GATEWAY_ID),
        paymentStatus: safe(payment?.status, SAFE_STATUS),
    })}`);
}

async function reportRefundRequired(order, payment, reason) {
    logRefundRequired(order, payment, reason);

    const paymentId = safe(payment?.id, SAFE_GATEWAY_ID);
    const gatewayOrderId = safe(payment?.order_id, SAFE_GATEWAY_ID);

    if (payment?.status !== "captured" || !paymentId || !gatewayOrderId
        || !Number.isSafeInteger(payment.amount) || payment.amount < 0 || !/^[A-Z]{3}$/.test(payment.currency ?? "")) return;

    await prisma.unappliedPayment.createMany({
        data: [{
            orderId: order.id,
            razorpayPaymentId: paymentId,
            razorpayOrderId: gatewayOrderId,
            amount: payment.amount,
            currency: payment.currency,
            reason,
        }],
        skipDuplicates: true,
    });
}

const holdsMoney = (payment) => ["captured", "authorized"].includes(payment?.status);

const refusal = (paid) => new ApiError(409, paid
    ? "This order has already been paid. Please contact support about the extra payment."
    : "This order can no longer be paid. Please contact support about a refund.");

// Applies a payment, as Razorpay reported it, to the order and returns the
// order's payment state: PAID, PROCESSING (authorized), FAILED or UNPAID.
// Only a captured payment of this gateway order, for exactly the stored
// amount and currency, marks the order PAID. A payment that cannot be applied
// is refused with a 409 (and reported for a refund when it holds money).
//
// Shared by browser verification, refresh, customer cancellation, the
// webhook and the expiry worker. `payment` comes from Razorpay itself: a
// fetch with the key secret, or a webhook whose signature was verified.
export async function applyPayment(order, payment) {
    if (payment?.order_id !== order.razorpayOrderId) {
        throw new ApiError(409, "This payment does not belong to this order");
    }

    if (payment.amount !== toMinorUnits(order.total, order.currency) || payment.currency !== order.currency) {
        if (holdsMoney(payment)) await reportRefundRequired(order, payment, "amount_or_currency_mismatch");
        throw new ApiError(409, "The payment amount does not match this order");
    }

    if (isExpiredUnpaid(order)) return applyLatePayment(order, payment);

    // Already paid by another payment, or cancelled/moved on, before this one could be applied.
    if (order.status !== "PENDING" || !PAYABLE_PAYMENT_STATUSES.includes(order.paymentStatus)) {
        const paid = order.paymentStatus === "PAID";
        if (paid && order.razorpayPaymentId === payment.id) return "PAID";
        if (holdsMoney(payment)) await reportRefundRequired(order, payment, paid ? "order_already_paid" : "order_not_payable");
        throw refusal(paid);
    }

    if (payment.status === "authorized") return "PROCESSING";
    if (payment.status === "failed") return "FAILED";
    if (payment.status !== "captured") return "UNPAID";

    // The deadline is not checked here: until the expiry transition commits the
    // stock is still held, so a payment that gets here first wins.
    let count;
    try {
        ({ count } = await prisma.order.updateMany({
            where: {
                id: order.id,
                userId: order.userId,
                razorpayOrderId: order.razorpayOrderId,
                status: "PENDING",
                paymentStatus: { in: PAYABLE_PAYMENT_STATUSES },
            },
            data: { paymentStatus: "PAID", razorpayPaymentId: payment.id, paidAt: new Date() },
        }));
    } catch (err) {
        // razorpayPaymentId is unique: this payment already paid another order.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new ApiError(409, "This payment has already been used");
        }
        throw err;
    }

    if (count === 0) return settleAfterChange(order.id, payment);

    return "PAID";
}

// The order changed while this payment was being applied: a concurrent
// verification of the same payment, another payment, a cancellation, or the
// expiry worker. Decided again from the committed row.
async function settleAfterChange(id, payment) {
    const current = await loadOrder(id);

    if (current.paymentStatus === "PAID" && current.razorpayPaymentId === payment.id) return "PAID";

    // Expired just before this payment could be applied: a late payment.
    if (isExpiredUnpaid(current)) return applyLatePayment(current, payment);

    const paid = current.paymentStatus === "PAID";
    await reportRefundRequired(current, payment, paid ? "order_already_paid" : "order_not_payable");
    throw refusal(paid);
}

// A payment for an order the expiry worker has already cancelled. Captured:
// reinstate the order as paid if all its items can be taken from stock again;
// otherwise it stays cancelled and the payment is recorded for a refund.
// Authorized: still PROCESSING (it is decided when Razorpay captures it).
async function applyLatePayment(order, payment) {
    if (payment.status === "authorized") return "PROCESSING";

    if (payment.status !== "captured") {
        throw new ApiError(409, "This order was cancelled because it was not paid in time. Please place a new order.");
    }

    // Decided, and a refund obligation recorded, in one locked transaction
    // (orderService). If it fails nothing is changed or lost: the payment is
    // decided again by the webhook's retry, a refresh, or the expiry worker's
    // late-payment check.
    let outcome;
    try {
        outcome = await reinstateExpiredOrder(order, payment);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            throw new ApiError(409, "This payment has already been used");
        }
        console.error(`Razorpay late payment not settled yet ${JSON.stringify({
            event: "razorpay_late_payment_pending",
            orderNumber: order.orderNumber,
            razorpayOrderId: safe(order.razorpayOrderId, SAFE_GATEWAY_ID),
            razorpayPaymentId: safe(payment.id, SAFE_GATEWAY_ID),
            error: typeof err?.code === "string" && /^[A-Z0-9_]{1,40}$/.test(err.code) ? err.code : "error",
        })}`);
        throw err;
    }

    if (outcome === "PAID") {
        console.log(`Razorpay late payment applied ${JSON.stringify({
            event: "razorpay_late_payment_applied",
            orderNumber: order.orderNumber,
            razorpayOrderId: safe(order.razorpayOrderId, SAFE_GATEWAY_ID),
            razorpayPaymentId: safe(payment.id, SAFE_GATEWAY_ID),
        })}`);
        return "PAID";
    }

    // Recorded in unapplied_payments (now, or by an earlier attempt): this
    // payment is refunded, never used for the order, even if stock returns.
    if (outcome === "REFUND_DUE") {
        logRefundRequired(order, payment, LATE_PAYMENT_STOCK_UNAVAILABLE);
        throw new ApiError(409, "This order expired before your payment arrived, and some items are no longer available. Your payment will be refunded; please contact support.");
    }

    // CHANGED: reinstated by a concurrent delivery of this payment, or paid by another.
    return settleAfterChange(order.id, payment);
}

// Applies the payment and returns { state, order } for the customer.
const settle = async (userId, order, payment) => result(await applyPayment(order, payment), userId, order.id);

// Called with what Razorpay Checkout returned to the browser. The signature
// proves those ids came from Razorpay; the order is then settled from the
// payment as Razorpay reports it, never from the browser's word.
export async function verifyPayment(userId, id, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    assertEnabled();

    const order = await loadOwnOrder(userId, id);
    assertOnlineOrder(order);

    if (!order.razorpayOrderId || razorpayOrderId !== order.razorpayOrderId) {
        throw new ApiError(409, "This payment does not belong to this order");
    }

    // Repeating the verification that paid the order: same answer, no work.
    if (order.paymentStatus === "PAID" && order.razorpayPaymentId === razorpayPaymentId) {
        return result("PAID", userId, id);
    }

    if (!isValidSignature(order.razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
        throw new ApiError(400, "Payment verification failed");
    }

    const payment = await callGateway("payment fetch", order.orderNumber, (g) => g.fetchPayment(razorpayPaymentId));

    // A second, genuine payment for an order that is already paid (applyPayment()
    // reports it and refuses it).
    return settle(userId, order, payment);
}

// Payment statuses that are final and hold no money for the order. Razorpay's
// documented statuses are created, authorized, captured, refunded and failed;
// "created" (the customer is still paying, e.g. a pending UPI request),
// "authorized" (about to be captured) and anything unrecognised are in flight.
const FINAL_UNPAID_STATUSES = new Set(["failed", "refunded"]);
const KNOWN_STATUSES = new Set(["created", "authorized", "captured", "refunded", "failed"]);

// Every payment of the order's gateway order. Razorpay's "fetch payments for an
// order" has no paging parameters and returns { entity, count, items }; a
// response whose count does not match its items, or with an item of another
// gateway order or without a status, is not trusted: the caller gets the same
// 502 as for an unreachable gateway, so nothing is decided from it.
async function fetchOrderPayments(order) {
    const response = await callGateway("order payments fetch", order.orderNumber, (g) => g.fetchOrderPayments(order.razorpayOrderId));
    const items = response?.items;

    const complete = Array.isArray(items)
        && Number.isInteger(response.count) && response.count === items.length
        && items.every((p) => p && typeof p === "object" && typeof p.id === "string"
            && p.order_id === order.razorpayOrderId && typeof p.status === "string");

    if (!complete) {
        console.error(`Razorpay order payments fetch for order ${order.orderNumber} was incomplete or malformed: ${JSON.stringify({
            count: Number.isInteger(response?.count) ? response.count : null,
            items: Array.isArray(items) ? items.length : null,
        })}`);
        throw new ApiError(502, "The payment provider could not be reached. Please try again.");
    }

    return items;
}

// The order's payments as Razorpay reports them, applied to the order; returns
// its payment state: PAID, PROCESSING (a payment is still in flight), FAILED
// (every attempt failed) or UNPAID (no attempt, or none that holds money).
// More than one captured payment means the customer paid twice: the one that
// paid (or now pays) the order stands, every other one is reported for refund.
// Used by refresh, customer cancellation and the expiry worker (which calls it
// outside any transaction, and expires an order only on FAILED or UNPAID,
// through expireOrder's own conditional UPDATE).
export async function reconcilePaymentState(order) {
    return (await assessOrderPayments(order)).state;
}

// The same, plus cutoffEligible for the expiry worker: true only when the
// state is PROCESSING because of payments that are all "created" (no
// authorized, unrecognised or captured payment at all, not even one of the
// wrong amount). Only then may the RESERVATION_CREATED_CUTOFF expire the order.
export async function assessOrderPayments(order) {
    const items = await fetchOrderPayments(order);
    const captured = items.filter((p) => p.status === "captured");
    const answer = (state, cutoffEligible = false) => ({ state, cutoffEligible });

    if (order.paymentStatus === "PAID") {
        for (const extra of captured.filter((p) => p.id !== order.razorpayPaymentId)) await reportRefundRequired(order, extra, "duplicate_capture");
        return answer("PAID");
    }

    // Only a capture of exactly the order's amount and currency can pay it; any
    // other capture is money to refund, and does not stop a matching one.
    const amount = toMinorUnits(order.total, order.currency);
    const matching = captured.filter((p) => p.amount === amount && p.currency === order.currency);

    for (const p of captured.filter((c) => !matching.includes(c))) await reportRefundRequired(order, p, "amount_or_currency_mismatch");

    if (matching.length) {
        for (const extra of matching.slice(1)) await reportRefundRequired(order, extra, "duplicate_capture");
        return answer(await applyPayment(order, matching[0]));
    }

    const inFlight = items.filter((p) => p.status !== "captured" && !FINAL_UNPAID_STATUSES.has(p.status));

    if (inFlight.length) {
        const unknown = inFlight.filter((p) => !KNOWN_STATUSES.has(p.status));
        if (unknown.length) {
            console.warn(`Razorpay payment status not recognised for order ${order.orderNumber}: ${JSON.stringify(unknown.map((p) => safe(p.status, SAFE_STATUS)))}`);
        }
        // Not capturable onto an order that has moved on: report it before it is captured.
        // (An expired order can still be reinstated if the payment is captured.)
        if (order.status !== "PENDING" && !isExpiredUnpaid(order)) {
            for (const p of inFlight.filter((i) => i.status === "authorized")) await reportRefundRequired(order, p, "order_not_payable");
        }
        return answer("PROCESSING", captured.length === 0 && inFlight.every((p) => p.status === "created"));
    }

    if (items.length && items.every((p) => p.status === "failed")) return answer("FAILED");

    return answer("UNPAID");
}

const reconcile = async (userId, order) => result(await reconcilePaymentState(order), userId, order.id);

// Re-checks the order's payment with Razorpay directly (no browser data):
// after a closed tab, a network error, or a payment still being processed.
// Paid orders are checked too, so a second captured payment is reported.
export async function refreshPayment(userId, id) {
    assertEnabled();

    const order = await loadOwnOrder(userId, id);
    assertOnlineOrder(order);

    if (!order.razorpayOrderId) return result(order.paymentStatus === "PAID" ? "PAID" : "UNPAID", userId, id);

    return reconcile(userId, order);
}

const PAYMENT_UNCERTAIN = "We couldn't confirm this order's payment status, so it can't be cancelled right now. Please try again in a moment.";

// Customer cancellation, made safe for online orders: a PENDING order with a
// Razorpay order may have a payment in flight, so Razorpay is asked first.
// Captured: the order is marked paid (and so is no longer cancellable).
// Authorized, or Razorpay unreachable: 409, nothing changes; the customer can
// retry. Otherwise, or for COD orders, cancelOrder() runs as before: its
// conditional UPDATE re-checks PENDING + UNPAID inside the transaction, so a
// payment verified in the meantime still wins.
export async function cancelOrderAfterPaymentCheck(userId, id) {
    const order = await loadOwnOrder(userId, id);

    if (order.paymentMethod === "RAZORPAY" && order.razorpayOrderId && order.status === "PENDING" && order.paymentStatus !== "PAID") {
        if (!isOnlinePaymentEnabled()) throw new ApiError(409, PAYMENT_UNCERTAIN);

        let state;
        try {
            ({ state } = await reconcile(userId, order));
        } catch (err) {
            // Gateway trouble (502): unknown. A 409 from settle() is a real answer.
            if (err instanceof ApiError && err.statusCode === 502) throw new ApiError(409, PAYMENT_UNCERTAIN);
            throw err;
        }

        if (state === "PAID") throw new ApiError(409, "This order has been paid and can no longer be cancelled");
        if (state === "PROCESSING") throw new ApiError(409, "Your payment is still being processed, so this order can't be cancelled yet");
    }

    return cancelOrder(userId, id);
}

/*
|--------------------------------------------------------------------------
| Reconciliation against Razorpay's payment list
|--------------------------------------------------------------------------
| The webhook stops retrying (and is disabled) after 24 hours of failures, and
| the expiry worker re-checks an expired order for 24 hours only. This job is
| the backstop: it lists every payment Razorpay holds for the last
| RECONCILE_WINDOW_MS (GET /payments with from/to, count 100, skip) and runs
| each captured payment of a local order through applyPayment, the same
| settlement every other path uses:
|   - an order still payable is paid;
|   - an expired order is reinstated if its stock is there, otherwise the
|     payment is recorded for a refund;
|   - a customer-cancelled order, an order already paid by another payment,
|     or an amount/currency mismatch: the payment is recorded for a refund.
| A payment that already paid its order, or already has a refund record, is
| skipped without a write. Everything is idempotent (conditional updates,
| unique refund records, decisions under the order's row lock), so repeated
| runs, several instances and a concurrent webhook change nothing twice.
|
| Payments are fetched first, outside any transaction. Nothing is inferred
| from a payment's absence: a page that fails or is malformed ends the
| listing for this run (the payments already listed are still processed) and
| the next run starts again. One payment that fails does not stop the others.
|
| Coverage limits: Razorpay documents the page size (count, at most 100) but
| not the sort order or whether from/to are inclusive. `to` is fixed when a
| run starts, payments are de-duplicated by id, and consecutive runs overlap
| almost completely, so each payment is seen by many runs. A window with more
| than RECONCILE_MAX_PAGES pages is processed only partly (and logged).
*/

export const RECONCILE_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;
export const RECONCILE_PAGE_SIZE = 100;
export const RECONCILE_MAX_PAGES = 50;

const LISTED_PAYMENT_ID = /^pay_[A-Za-z0-9]{1,40}$/;
const LISTED_ORDER_ID = /^order_[A-Za-z0-9]{1,40}$/;

// The fields a listed captured payment must have, or null.
function listedPayment(raw) {
    if (!raw || typeof raw !== "object" || !LISTED_PAYMENT_ID.test(raw.id ?? "") || !LISTED_ORDER_ID.test(raw.order_id ?? "")
        || !Number.isSafeInteger(raw.amount) || raw.amount < 0 || !/^[A-Z]{3}$/.test(raw.currency ?? "")) return null;

    return { id: raw.id, order_id: raw.order_id, amount: raw.amount, currency: raw.currency, status: raw.status };
}

const errorCode = (err) => (Number.isInteger(err?.statusCode) ? err.statusCode : /^[A-Z0-9_]{1,40}$/.test(err?.code ?? "") ? err.code : "error");

// One captured payment -> "paid", "settled_before", "recorded_before",
// "refused" (refused, and recorded for a refund) or "unknown_order".
async function reconcileListedPayment(payment) {
    const order = await loadOrderByGatewayOrder(payment.order_id);

    if (!order) {
        console.warn(`Razorpay reconciliation: payment for an unknown order ${JSON.stringify({
            razorpayOrderId: payment.order_id, razorpayPaymentId: payment.id,
        })}`);
        return "unknown_order";
    }

    if (order.paymentStatus === "PAID" && order.razorpayPaymentId === payment.id) return "settled_before";

    const recorded = await prisma.unappliedPayment.findUnique({ where: { razorpayPaymentId: payment.id }, select: { id: true } });
    if (recorded) return "recorded_before";

    try {
        return (await applyPayment(order, payment)) === "PAID" ? "paid" : "refused";
    } catch (err) {
        if (err instanceof ApiError && [409, 422].includes(err.statusCode)) return "refused";
        throw err;
    }
}

// One run; returns a summary. `now` and the sizes are for tests.
export async function reconcileRecentPayments({
    now = new Date(), windowMs = RECONCILE_WINDOW_MS, pageSize = RECONCILE_PAGE_SIZE, maxPages = RECONCILE_MAX_PAGES,
} = {}) {
    const summary = {
        complete: false, stopped: null, pages: 0, listed: 0, captured: 0, duplicates: 0, malformed: 0,
        paid: 0, settled_before: 0, recorded_before: 0, refused: 0, unknown_order: 0, failed: 0,
    };

    if (!isOnlinePaymentEnabled()) {
        summary.stopped = "disabled";
        return summary;
    }

    const to = Math.floor(now.getTime() / 1000);
    const from = Math.floor((now.getTime() - windowMs) / 1000);
    const byId = new Map();

    for (let page = 0; page < maxPages; page++) {
        let response;
        try {
            response = await getGateway().listPayments({ from, to, count: pageSize, skip: page * pageSize });
        } catch (err) {
            summary.stopped = "fetch_failed";
            console.error(`Razorpay reconciliation: payments page ${page + 1} could not be fetched: ${errorCode(err)}`);
            break;
        }

        const items = response?.items;
        if (!Array.isArray(items) || !Number.isInteger(response.count) || response.count !== items.length || items.length > pageSize) {
            summary.stopped = "malformed_page";
            console.error(`Razorpay reconciliation: payments page ${page + 1} was malformed`);
            break;
        }

        summary.pages += 1;
        summary.listed += items.length;

        for (const raw of items) {
            if (raw?.status !== "captured") continue;
            const payment = listedPayment(raw);
            if (!payment) {
                summary.malformed += 1;
                continue;
            }
            if (byId.has(payment.id)) {
                summary.duplicates += 1;
                continue;
            }
            byId.set(payment.id, payment);
        }

        if (items.length < pageSize) {
            summary.complete = true;
            break;
        }
    }

    if (!summary.complete && !summary.stopped) {
        summary.stopped = "page_limit";
        console.warn(`Razorpay reconciliation: more than ${maxPages} pages of payments in the window; the rest waits for the next run`);
    }

    summary.captured = byId.size;

    // Settled one by one (outside any transaction of this job); one failure
    // does not stop the rest.
    for (const payment of byId.values()) {
        try {
            summary[await reconcileListedPayment(payment)] += 1;
        } catch (err) {
            summary.failed += 1;
            console.error(`Razorpay reconciliation: payment ${JSON.stringify({ razorpayOrderId: payment.order_id, razorpayPaymentId: payment.id })} failed: ${errorCode(err)}`);
        }
    }

    console.log(`Razorpay reconciliation ${JSON.stringify(summary)}`);

    return summary;
}
