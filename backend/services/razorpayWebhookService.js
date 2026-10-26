import crypto from "node:crypto";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { applyPayment, loadOrderByGatewayOrder } from "./paymentService.js";

/*
|--------------------------------------------------------------------------
| Razorpay webhooks
|--------------------------------------------------------------------------
| Razorpay POSTs events to /api/webhooks/razorpay. Each request is handled as:
|
| 1. Signature: X-Razorpay-Signature must be the hex HMAC-SHA256 of the exact
|    raw body with RAZORPAY_WEBHOOK_SECRET (the secret set on the webhook in
|    the dashboard; never the API key secret). Compared in constant time.
|    Nothing in the body is read before this passes.
| 2. Idempotency: the event key is Razorpay's X-Razorpay-Event-Id (the same on
|    every retry of one event), or a hash of the body without it. An event key
|    already in razorpay_webhook_events is answered without processing.
| 3. Processing, through paymentService.applyPayment (the same rules as the
|    browser verification). Every effect is a conditional UPDATE, so even an
|    event processed twice (two concurrent deliveries, or the same payment
|    from a webhook and the browser) changes the order once.
| 4. Only then is the event key recorded, and 200 returned. A database or
|    other unexpected error returns 500 without recording it, so Razorpay
|    retries the event later.
|
| Payment details are taken from the signed payload (it comes from Razorpay);
| no network call is made. Business refusals (amount mismatch, an order that
| cannot be paid) are final answers: recorded, refund reported where money is
| held, and acknowledged with 200 so Razorpay does not retry them forever.
|
| Handled events: payment.captured and order.paid (apply the payment),
| payment.failed (acknowledged; a failed attempt never changes an order, so
| it cannot undo a payment), refund.processed (marks an unapplied payment as
| refunded). Anything else is acknowledged and ignored.
*/

const webhookSecret = () => String(process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim();

export const isWebhookEnabled = () => Boolean(webhookSecret());

const HEX_SIGNATURE = /^[0-9a-f]{64}$/i;
const EVENT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{1,40}$/;
const ORDER_ID = /^order_[A-Za-z0-9]{1,40}$/;
const REFUND_ID = /^rfnd_[A-Za-z0-9]{1,40}$/;
const CURRENCY = /^[A-Z]{3}$/;
const STATUS = /^[a-z_]{1,20}$/;

// Constant-time check of the hex HMAC-SHA256 of the raw body.
export function isValidWebhookSignature(rawBody, signature, secret = webhookSecret()) {
    if (!secret || !Buffer.isBuffer(rawBody) || typeof signature !== "string" || !HEX_SIGNATURE.test(signature)) return false;

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
    const given = Buffer.from(signature, "hex");

    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const badRequest = (message) => new ApiError(400, message);

// The payment entity of a payment event, checked field by field.
function paymentEntity(body) {
    const payment = body?.payload?.payment?.entity;

    if (!payment || typeof payment !== "object"
        || !PAYMENT_ID.test(payment.id ?? "") || !ORDER_ID.test(payment.order_id ?? "")
        || !Number.isSafeInteger(payment.amount) || payment.amount < 0
        || !CURRENCY.test(payment.currency ?? "") || !STATUS.test(payment.status ?? "")) {
        throw badRequest("Malformed payment event");
    }

    return { id: payment.id, order_id: payment.order_id, amount: payment.amount, currency: payment.currency, status: payment.status };
}

function refundEntity(body) {
    const refund = body?.payload?.refund?.entity;

    if (!refund || typeof refund !== "object" || !REFUND_ID.test(refund.id ?? "") || !PAYMENT_ID.test(refund.payment_id ?? "")
        || !Number.isSafeInteger(refund.amount) || refund.amount <= 0 || !CURRENCY.test(refund.currency ?? "")) {
        throw badRequest("Malformed refund event");
    }

    return { id: refund.id, payment_id: refund.payment_id, amount: refund.amount, currency: refund.currency };
}

// -> outcome (recorded with the event key)
async function handlePaymentEvent(payment, { capture }) {
    // Resolved by the gateway order id stored when the payment was started;
    // the payload never names a local order.
    const order = await loadOrderByGatewayOrder(payment.order_id);

    if (!order) return "unknown_order";

    // A failed attempt changes nothing: the order stays payable (or paid).
    if (!capture) return "failed_ignored";

    if (payment.status !== "captured") return "not_captured";

    try {
        const state = await applyPayment(order, payment);
        return state === "PAID" ? "paid" : `state_${state.toLowerCase()}`;
    } catch (err) {
        // A final business answer (reported for a refund where money is held).
        if (err instanceof ApiError && [409, 422].includes(err.statusCode)) return "refused";
        throw err;
    }
}

// Only a full refund of an unapplied payment, as Razorpay reports it processed.
async function handleRefundProcessed(refund) {
    const { count } = await prisma.unappliedPayment.updateMany({
        where: { razorpayPaymentId: refund.payment_id, refundedAt: null, amount: refund.amount, currency: refund.currency },
        data: { refundedAt: new Date(), razorpayRefundId: refund.id },
    });

    return count ? "refund_recorded" : "refund_not_tracked";
}

// rawBody: the request body bytes; headers: lower-cased request headers.
// -> { status, outcome }. `hooks.beforeRecord()` is a test seam (a failure
// after the event's changes committed); the controller never passes it.
export async function handleWebhook(rawBody, headers, hooks) {
    if (!isWebhookEnabled()) throw new ApiError(503, "Webhooks are not configured");

    if (!isValidWebhookSignature(rawBody, headers["x-razorpay-signature"])) {
        throw badRequest("Invalid webhook signature");
    }

    let body;
    try {
        body = JSON.parse(rawBody.toString("utf8"));
    } catch {
        throw badRequest("Malformed webhook body");
    }

    const event = typeof body?.event === "string" && /^[a-z_.]{1,64}$/.test(body.event) ? body.event : null;
    if (!event) throw badRequest("Malformed webhook body");

    const headerId = headers["x-razorpay-event-id"];
    const eventKey = typeof headerId === "string" && EVENT_ID.test(headerId)
        ? headerId
        : `sha256:${crypto.createHash("sha256").update(rawBody).digest("hex")}`;

    const seen = await prisma.razorpayWebhookEvent.findUnique({ where: { eventKey }, select: { outcome: true } });
    if (seen) return { status: "duplicate", outcome: seen.outcome };

    let outcome;
    let ids = {};

    if (event === "payment.captured" || event === "order.paid" || event === "payment.failed") {
        const payment = paymentEntity(body);
        ids = { razorpayOrderId: payment.order_id, razorpayPaymentId: payment.id };
        outcome = await handlePaymentEvent(payment, { capture: event !== "payment.failed" });
    } else if (event === "refund.processed") {
        const refund = refundEntity(body);
        ids = { razorpayPaymentId: refund.payment_id };
        outcome = await handleRefundProcessed(refund);
    } else {
        outcome = "ignored";
    }

    await hooks?.beforeRecord?.();

    // Recorded only now that the event's changes are committed. A concurrent
    // delivery of the same event may have recorded it first: that is fine.
    await prisma.razorpayWebhookEvent.createMany({ data: [{ eventKey, event, outcome, ...ids }], skipDuplicates: true });

    if (["unknown_order", "refused", "refund_not_tracked"].includes(outcome)) {
        console.warn(`Razorpay webhook ${JSON.stringify({ event, outcome, ...ids })}`);
    }

    return { status: "processed", outcome };
}
