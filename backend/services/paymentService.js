import crypto from "node:crypto";
import Razorpay from "razorpay";
import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { cancelOrder, getOrder } from "./orderService.js";

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
| Marking PAID is one conditional UPDATE (still PENDING, still unpaid, same
| gateway order), so repeated or concurrent verifications settle once and
| later ones return the same result. A failed attempt leaves the order UNPAID:
| the customer can retry, or cancel it (which restores stock).
|
| Nothing here logs the key secret, signatures or payment details; failures
| log the order number and the gateway's status code only.
*/

// Minor units per major unit for the currencies accepted online.
const CURRENCY_EXPONENTS = { INR: 2, USD: 2 };

const PAYABLE_PAYMENT_STATUSES = ["UNPAID", "FAILED"];

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
};

// Only the owner's order: another user's id behaves exactly like a missing one.
async function loadOwnOrder(userId, id) {
    const order = await prisma.order.findFirst({ where: { id, userId }, select: paymentSelect });

    if (!order) throw new ApiError(404, "Order not found");

    return order;
}

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
}

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

const holdsMoney = (payment) => ["captured", "authorized"].includes(payment?.status);

// Applies a payment fetched from Razorpay to the order. Only a captured
// payment of this gateway order, for exactly the stored amount and currency,
// marks the order PAID.
async function settle(userId, order, payment) {
    if (payment?.order_id !== order.razorpayOrderId) {
        throw new ApiError(409, "This payment does not belong to this order");
    }

    if (payment.amount !== toMinorUnits(order.total, order.currency) || payment.currency !== order.currency) {
        if (holdsMoney(payment)) logRefundRequired(order, payment, "amount_or_currency_mismatch");
        throw new ApiError(409, "The payment amount does not match this order");
    }

    // Already paid by another payment, or cancelled/moved on, before this one could be applied.
    if (order.status !== "PENDING" || !PAYABLE_PAYMENT_STATUSES.includes(order.paymentStatus)) {
        const paid = order.paymentStatus === "PAID";
        if (holdsMoney(payment)) logRefundRequired(order, payment, paid ? "order_already_paid" : "order_not_payable");
        throw new ApiError(409, paid
            ? "This order has already been paid. Please contact support about the extra payment."
            : "This order can no longer be paid. Please contact support about a refund.");
    }

    if (payment.status === "authorized") return result("PROCESSING", userId, order.id);
    if (payment.status === "failed") return result("FAILED", userId, order.id);
    if (payment.status !== "captured") return result("UNPAID", userId, order.id);

    let count;
    try {
        ({ count } = await prisma.order.updateMany({
            where: {
                id: order.id,
                userId,
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

    if (count === 0) {
        const current = await loadOwnOrder(userId, order.id);

        // A concurrent verification of the same payment got there first.
        if (current.paymentStatus === "PAID" && current.razorpayPaymentId === payment.id) {
            return result("PAID", userId, order.id);
        }

        // Changed while this payment was being applied (paid by another payment, or cancelled).
        logRefundRequired(current, payment, current.paymentStatus === "PAID" ? "order_already_paid" : "order_not_payable");

        throw new ApiError(409, current.paymentStatus === "PAID"
            ? "This order has already been paid. Please contact support about the extra payment."
            : "This order can no longer be paid. Please contact support about a refund.");
    }

    return result("PAID", userId, order.id);
}

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

    // A second, genuine payment for an order that is already paid (settle()
    // reports it as order_not_payable and refuses it).
    return settle(userId, order, payment);
}

// The order's payments as Razorpay reports them, applied to the order. More
// than one captured payment means the customer paid twice: the one that paid
// (or now pays) the order stands, every other one is reported for refund.
async function reconcile(userId, order) {
    const payments = await callGateway("order payments fetch", order.orderNumber, (g) => g.fetchOrderPayments(order.razorpayOrderId));
    const items = (Array.isArray(payments?.items) ? payments.items : []).filter((p) => p?.order_id === order.razorpayOrderId);
    const captured = items.filter((p) => p.status === "captured");

    if (order.paymentStatus === "PAID") {
        for (const extra of captured.filter((p) => p.id !== order.razorpayPaymentId)) logRefundRequired(order, extra, "duplicate_capture");
        return result("PAID", userId, order.id);
    }

    if (captured.length) {
        for (const extra of captured.slice(1)) logRefundRequired(order, extra, "duplicate_capture");
        return settle(userId, order, captured[0]);
    }

    if (items.some((p) => p.status === "authorized")) {
        // Not capturable onto an order that has moved on: report it before it is captured.
        if (order.status !== "PENDING") {
            for (const p of items.filter((i) => i.status === "authorized")) logRefundRequired(order, p, "order_not_payable");
        }
        return result("PROCESSING", userId, order.id);
    }

    if (items.length && items.every((p) => p.status === "failed")) return result("FAILED", userId, order.id);

    return result("UNPAID", userId, order.id);
}

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
