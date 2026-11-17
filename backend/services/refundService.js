import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { NOT_YET_SHIPPED, restoreStock } from "./orderService.js";
import { toMinorUnits } from "./pricingService.js";
import { deliverRefundEmail } from "./orderEmailService.js";

/*
|--------------------------------------------------------------------------
| Refund reconciliation
|--------------------------------------------------------------------------
| Every processed Razorpay refund is stored once in razorpay_refunds (unique
| razorpayRefundId), as soon as its webhook arrives, whether or not the
| payment it refunds is known yet. Everything else is derived from those rows
| by settleRefundsForPayment(paymentId), which is idempotent and is called by
| every path that can make a refund matchable:
|   - the refund.processed webhook, right after storing the refund;
|   - applyPayment, right after a capture marks an order PAID (and on the
|     "already PAID by this payment" path, so a crash in between is repaired);
|   - the late-payment path, after a reinstatement or a refund record;
|   - the refund worker's sweep of refunds not settled yet.
| A capture commits PAID and then settles; a refund commits its row and then
| settles; settle reads both under a lock. Whichever settles last sees both,
| so a refund is never missed, whatever the order of arrival.
|
| For one Razorpay payment (only refunds in the payment's currency count):
|   capturedAmount  what the payment captured, in minor units
|   refundedAmount  sum of its processed refunds
|   netRetained     max(capturedAmount - refundedAmount, 0)
|   refundState     NONE, PARTIAL (0 < refunded < captured) or FULL
|   anomalies       CURRENCY_MISMATCH (a refund in another currency: stored,
|                   linked and emailed, never counted), OVER_REFUNDED
|                   (refunded > captured: treated as FULL, flagged)
|
| Settling, in one transaction that first locks the row the payment belongs to:
|   the payment that paid an order (orders.razorpayPaymentId), order locked:
|     FULL and the order PAID -> paymentStatus and status REFUNDED, by a
|     conditional UPDATE; stock is returned only by the transaction whose
|     UPDATE matched, and only if the order had not shipped. PARTIAL changes
|     no status: fulfilment waits for an admin acknowledgement (below).
|   an unapplied payment (money held for no order), its row locked:
|     FULL -> refundedAt set once. PARTIAL: still owed (refundDue stays true).
|   neither: the refund waits (settledAt NULL) for one of the paths above.
| Each refund row is marked settled once (settledAt IS NULL in the UPDATE),
| which also puts its customer email in the outbox (emailDueAt).
|
| Lock order: orders (or unapplied_payments) -> razorpay_refunds -> variants,
| the same orders-before-variants order as cancellation, expiry and reinstatement.
*/

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

// razorpay_refunds.amount is INT UNSIGNED.
const MAX_REFUND_AMOUNT = 4_294_967_295;

// -> the derived amounts for one payment. capturedAmount and refunds are in
// minor units; refunds: [{ amount, currency }].
export function summarizeRefunds(capturedAmount, currency, refunds) {
    let refundedAmount = 0;
    let mismatched = 0;

    for (const refund of refunds) {
        if (refund.currency === currency) refundedAmount += Number(refund.amount);
        else mismatched += 1;
    }

    const anomalies = [];
    if (mismatched) anomalies.push("CURRENCY_MISMATCH");
    if (refundedAmount > capturedAmount) anomalies.push("OVER_REFUNDED");

    return {
        capturedAmount,
        refundedAmount,
        netRetained: Math.max(capturedAmount - refundedAmount, 0),
        refundState: refundedAmount === 0 ? "NONE" : refundedAmount >= capturedAmount ? "FULL" : "PARTIAL",
        currency,
        refundCount: refunds.length,
        anomalies,
    };
}

// The refunds of one payment, as a locking read (the latest committed rows,
// whatever this transaction's snapshot), held until the transaction ends.
export function lockRefunds(tx, razorpayPaymentId) {
    return tx.$queryRaw`
        SELECT id, razorpayRefundId, amount, currency, settledAt FROM razorpay_refunds
        WHERE razorpayPaymentId = ${razorpayPaymentId} ORDER BY id FOR SHARE`;
}

// Whether a refund state needs an admin acknowledgement before fulfilment,
// and whether the order's stored acknowledgement still covers it. It covers
// only the exact state it was given for: the same number of refund records
// with the same counted total. A later refund always changes the count.
// A FULL state needs no review: the order is REFUNDED and can never be
// fulfilled (an over-refund is still flagged in the anomalies).
export function refundReview(order, summary) {
    const required = summary.refundCount > 0 && summary.refundState !== "FULL"
        && (summary.refundState === "PARTIAL" || summary.anomalies.length > 0);
    const acknowledged = required
        && order.refundReviewedAt != null
        && Number(order.refundReviewedCount) === summary.refundCount
        && Number(order.refundReviewedAmount) === summary.refundedAmount;

    return { required, acknowledged, blocking: required && !acknowledged };
}

// Stores a processed refund. -> true if this call stored it, false if it was
// already stored (a duplicate or concurrent delivery). The same refund id
// with different details is refused (409): it is never silently merged.
export async function recordRefund({ id, payment_id: paymentId, amount, currency }) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_REFUND_AMOUNT) {
        throw new ApiError(400, "Malformed refund event");
    }

    try {
        await prisma.razorpayRefund.create({ data: { razorpayRefundId: id, razorpayPaymentId: paymentId, amount, currency } });
        return true;
    } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }

    const stored = await prisma.razorpayRefund.findUnique({ where: { razorpayRefundId: id } });

    if (!stored || stored.razorpayPaymentId !== paymentId || stored.amount !== amount || stored.currency !== currency) {
        console.error(`Razorpay refund conflict ${JSON.stringify({ event: "razorpay_refund_conflict", razorpayRefundId: id })}`);
        throw new ApiError(409, "Refund conflicts with a stored refund");
    }

    return false;
}

// Marks the given unsettled refund rows settled and due for their email.
// -> the ids this call settled.
async function settleRows(tx, refunds, orderId) {
    const unsettled = refunds.filter((r) => r.settledAt == null).map((r) => Number(r.id));
    if (!unsettled.length) return [];

    const now = new Date();
    await tx.razorpayRefund.updateMany({
        where: { id: { in: unsettled }, settledAt: null },
        data: { settledAt: now, orderId, emailDueAt: now },
    });

    return unsettled;
}

function logAnomalies(paymentId, summary, where) {
    if (!summary.anomalies.length) return;
    console.error(`Razorpay refund anomaly ${JSON.stringify({
        event: "razorpay_refund_anomaly", where, razorpayPaymentId: paymentId,
        anomalies: summary.anomalies, capturedAmount: summary.capturedAmount, refundedAmount: summary.refundedAmount,
    })}`);
}

// Settles every refund of one payment (see the header). Idempotent; safe to
// call concurrently. -> { outcome, summary? }. outcome (stored with webhook
// events, at most 40 characters): order_refunded (this call moved the order
// to REFUNDED), order_refund_partial, order_refund_full (already REFUNDED),
// unapplied_refunded, unapplied_refund_partial, unapplied_refund_full,
// refund_pending_match (no order or unapplied payment yet), no_refunds.
export async function settleRefundsForPayment(paymentId) {
    const result = await prisma.$transaction(async (tx) => {
        const [order] = await tx.$queryRaw`
            SELECT id, status, paymentStatus, total, currency FROM orders
            WHERE razorpayPaymentId = ${paymentId} FOR UPDATE`;

        if (order) {
            const refunds = await lockRefunds(tx, paymentId);
            if (!refunds.length) return { outcome: "no_refunds" };

            const summary = summarizeRefunds(toMinorUnits(order.total, order.currency), order.currency, refunds);
            const settled = await settleRows(tx, refunds, order.id);
            let outcome = `order_refund_${summary.refundState.toLowerCase()}`;

            if (summary.refundState === "FULL" && order.paymentStatus === "PAID") {
                const { count } = await tx.order.updateMany({
                    where: { id: order.id, razorpayPaymentId: paymentId, paymentStatus: "PAID" },
                    data: { paymentStatus: "REFUNDED", status: "REFUNDED" },
                });

                if (count === 1) {
                    outcome = "order_refunded";
                    // Goods not yet shipped go back on sale; shipped goods are
                    // with the courier or customer (a return is handled by hand).
                    // Coupon uses are kept: per-customer limits count every
                    // order that is not CANCELLED (couponService).
                    if (NOT_YET_SHIPPED.includes(order.status)) await restoreStock(tx, order.id, async () => {});
                }
            }

            return { outcome, summary, settled, where: `order:${order.id}` };
        }

        const [unapplied] = await tx.$queryRaw`
            SELECT id, orderId, amount, currency, refundedAt FROM unapplied_payments
            WHERE razorpayPaymentId = ${paymentId} FOR UPDATE`;

        if (unapplied) {
            const refunds = await lockRefunds(tx, paymentId);
            if (!refunds.length) return { outcome: "no_refunds" };

            const summary = summarizeRefunds(Number(unapplied.amount), unapplied.currency, refunds);
            const settled = await settleRows(tx, refunds, Number(unapplied.orderId));
            let outcome = `unapplied_refund_${summary.refundState.toLowerCase()}`;

            if (summary.refundState === "FULL" && unapplied.refundedAt == null) {
                // The refund that completed it (the latest counted one).
                const last = refunds.filter((r) => r.currency === unapplied.currency).at(-1);
                const { count } = await tx.unappliedPayment.updateMany({
                    where: { id: Number(unapplied.id), refundedAt: null },
                    data: { refundedAt: new Date(), razorpayRefundId: last.razorpayRefundId },
                });
                if (count === 1) outcome = "unapplied_refunded";
            }

            return { outcome, summary, settled, where: `unapplied:${Number(unapplied.id)}` };
        }

        return { outcome: "refund_pending_match" };
    }, TRANSACTION_OPTIONS);

    if (result.summary) logAnomalies(paymentId, result.summary, result.where);

    // Committed: send the emails of the refunds this call settled now, without
    // waiting. The outbox keeps them due, so the worker retries any that fail.
    if (result.settled?.length) queueRefundEmails(result.settled);

    return { outcome: result.outcome, summary: result.summary };
}

// Counted refunds already stored for a payment (a plain read, used before a
// capture is applied; settle re-checks under a lock afterwards).
export async function refundedAmountOf(paymentId, currency) {
    const { _sum } = await prisma.razorpayRefund.aggregate({
        where: { razorpayPaymentId: paymentId, currency },
        _sum: { amount: true },
    });

    return Number(_sum.amount ?? 0);
}

/*
|--------------------------------------------------------------------------
| Admin acknowledgement of a partial refund
|--------------------------------------------------------------------------
| advanceOrderStatus refuses an online order whose payment has a PARTIAL
| refund state (or a refund anomaly) unless the order's acknowledgement
| covers the current state. The admin acknowledges the state they were shown
| (refundCount, refundedAmount); if a refund arrived since, the numbers
| differ and the acknowledgement is refused (409), so it can never approve a
| state the admin has not seen. Both checks lock the order row first.
*/

// Inside advanceOrderStatus's transaction, with the order row locked.
export async function assertFulfilmentAllowed(tx, order) {
    if (!order.razorpayPaymentId) return;

    const refunds = await lockRefunds(tx, order.razorpayPaymentId);
    if (!refunds.length) return;

    const summary = summarizeRefunds(toMinorUnits(order.total, order.currency), order.currency, refunds);

    if (refundReview(order, summary).blocking) {
        throw new ApiError(409, "This order has a refund that an admin must review and acknowledge before it can be fulfilled.", [
            { field: "refund", code: "REFUND_REVIEW_REQUIRED", message: "Refund review required" },
        ]);
    }
}

export async function acknowledgeRefund(orderId, adminId, { refundCount, refundedAmount }) {
    await prisma.$transaction(async (tx) => {
        const [order] = await tx.$queryRaw`
            SELECT id, orderNumber, paymentStatus, razorpayPaymentId, total, currency FROM orders WHERE id = ${orderId} FOR UPDATE`;

        if (!order) throw new ApiError(404, "Order not found");

        const refunds = order.razorpayPaymentId ? await lockRefunds(tx, order.razorpayPaymentId) : [];
        if (!refunds.length) throw new ApiError(409, "This order has no refunds to review");

        const summary = summarizeRefunds(toMinorUnits(order.total, order.currency), order.currency, refunds);

        if (summary.refundCount !== refundCount || summary.refundedAmount !== refundedAmount) {
            throw new ApiError(409, "The refunds on this order have changed. Reload the order and review them again.", [
                { field: "refundCount", code: "REFUNDS_CHANGED", message: "Refunds changed since they were shown" },
            ]);
        }

        if (!refundReview({}, summary).required) {
            throw new ApiError(409, "This order's refunds do not need a review");
        }

        await tx.order.update({
            where: { id: orderId },
            data: { refundReviewedAt: new Date(), refundReviewedById: adminId, refundReviewedCount: refundCount, refundReviewedAmount: refundedAmount },
        });

        console.log(`Refund review acknowledged ${JSON.stringify({
            event: "refund_review_acknowledged", orderNumber: order.orderNumber, adminId, refundCount, refundedAmount,
            refundState: summary.refundState, anomalies: summary.anomalies,
        })}`);
    }, TRANSACTION_OPTIONS);
}

// Admin view of one payment's refunds: the derived amounts plus every
// refund record (amounts in minor units, as Razorpay reports them).
function paymentRefundView(capturedAmount, currency, refunds) {
    return {
        ...summarizeRefunds(capturedAmount, currency, refunds),
        refunds: refunds.map((r) => ({
            razorpayRefundId: r.razorpayRefundId,
            amount: r.amount,
            currency: r.currency,
            counted: r.currency === currency,
            receivedAt: r.receivedAt,
            settledAt: r.settledAt,
            // SENT, PENDING, RETRYING (a send failed; due again), NO_RECIPIENT,
            // GAVE_UP, or WAITING_FOR_MATCH (not settled: recipient unknown yet).
            emailStatus: r.emailSentAt ? "SENT"
                : r.settledAt == null ? "WAITING_FOR_MATCH"
                    : r.emailDueAt ? (r.emailLastError ? "RETRYING" : "PENDING")
                        : r.emailLastError ?? "PENDING",
            // The latest admin resend of an exhausted email, if any.
            emailResendRequestedAt: r.emailResendRequestedAt,
            emailResendRequestedBy: r.emailResendRequestedBy
                ? { id: r.emailResendRequestedBy.id, name: `${r.emailResendRequestedBy.firstName} ${r.emailResendRequestedBy.lastName}`.trim() }
                : null,
        })),
    };
}

const REFUND_VIEW_SELECT = {
    razorpayRefundId: true, razorpayPaymentId: true, amount: true, currency: true, receivedAt: true, settledAt: true,
    emailSentAt: true, emailDueAt: true, emailLastError: true, emailResendRequestedAt: true,
    emailResendRequestedBy: { select: { id: true, firstName: true, lastName: true } },
};

// For GET /admin/orders/:id. order: razorpayPaymentId, total, currency, the
// refundReviewed* columns, refundReviewedBy { id, firstName, lastName }, and
// unappliedPayments [{ razorpayPaymentId, amount, currency }].
// -> { payment: view | null, review, unapplied: { [razorpayPaymentId]: view } }
export async function adminRefundView(order) {
    const paymentIds = [order.razorpayPaymentId, ...order.unappliedPayments.map((p) => p.razorpayPaymentId)].filter(Boolean);
    const rows = paymentIds.length
        ? await prisma.razorpayRefund.findMany({ where: { razorpayPaymentId: { in: paymentIds } }, orderBy: { id: "asc" }, select: REFUND_VIEW_SELECT })
        : [];
    const of = (paymentId) => rows.filter((r) => r.razorpayPaymentId === paymentId);

    const paid = order.razorpayPaymentId ? of(order.razorpayPaymentId) : [];
    const payment = paid.length ? paymentRefundView(toMinorUnits(order.total, order.currency), order.currency, paid) : null;
    const review = payment ? refundReview(order, payment) : { required: false, acknowledged: false, blocking: false };

    return {
        payment,
        review: {
            ...review,
            reviewedAt: order.refundReviewedAt,
            reviewedBy: order.refundReviewedBy
                ? { id: order.refundReviewedBy.id, name: `${order.refundReviewedBy.firstName} ${order.refundReviewedBy.lastName}`.trim() }
                : null,
            reviewedCount: order.refundReviewedCount,
            reviewedAmount: order.refundReviewedAmount,
        },
        unapplied: Object.fromEntries(order.unappliedPayments.map((p) => [p.razorpayPaymentId, paymentRefundView(p.amount, p.currency, of(p.razorpayPaymentId))])),
    };
}

// For the admin order list: per order id, { refundState, refundReviewRequired }
// of the payment that paid it (orders without refunds are left out).
export async function adminRefundBadges(orders) {
    const paid = orders.filter((o) => o.razorpayPaymentId);
    if (!paid.length) return new Map();

    const rows = await prisma.razorpayRefund.findMany({
        where: { razorpayPaymentId: { in: paid.map((o) => o.razorpayPaymentId) } },
        select: { razorpayPaymentId: true, amount: true, currency: true },
    });

    const badges = new Map();
    for (const order of paid) {
        const refunds = rows.filter((r) => r.razorpayPaymentId === order.razorpayPaymentId);
        if (!refunds.length) continue;
        const summary = summarizeRefunds(toMinorUnits(order.total, order.currency), order.currency, refunds);
        badges.set(order.id, { refundState: summary.refundState, refundAnomalies: summary.anomalies, refundReviewRequired: refundReview(order, summary).blocking });
    }

    return badges;
}

/*
|--------------------------------------------------------------------------
| Refund email outbox (at least once, one email per refund)
|--------------------------------------------------------------------------
| A refund row is due (emailDueAt <= now, emailSentAt NULL) from the moment
| it is settled. A sender first claims the row with a conditional UPDATE
| (emailLockedUntil in the future, attempts + 1), so concurrent senders (the
| fast path after settling, the worker, other instances) never send it at
| the same time. Accepted by the provider: emailSentAt is set and it is never
| sent again. Failed: due again after a backoff, up to EMAIL_MAX_ATTEMPTS.
| Every later write is fenced on the claim (see deliverOneRefundEmail), and
| one attempt is cut off after EMAIL_SEND_TIMEOUT_MS, inside the claim.
| A crash after the provider accepted the message but before emailSentAt is
| written leaves the row due once its claim expires: it is sent again. That
| duplicate is the price of at-least-once over SMTP, which has no idempotency
| key; each refund's message has a fixed Message-ID, which many mail
| services use to drop a second copy, but that is not guaranteed.
*/

export const EMAIL_CLAIM_MS = 2 * 60 * 1000;
// Hard limit on one attempt (preparing and sending), well inside the claim.
export const EMAIL_SEND_TIMEOUT_MS = 90 * 1000;
export const EMAIL_MAX_ATTEMPTS = 12;
const EMAIL_BATCH_SIZE = 20;
const EMAIL_MAX_BACKOFF_MS = 60 * 60 * 1000;

const backoffMs = (attempts) => Math.min(2 ** Math.max(attempts - 1, 0) * 60 * 1000, EMAIL_MAX_BACKOFF_MS);

// In-flight fast-path deliveries, so tests can wait for them.
const pending = new Set();

export function queueRefundEmails(ids) {
    const promise = deliverDueRefundEmails({ ids }).catch((err) => {
        console.error(`Refund email delivery failed: ${err?.code ?? err?.name ?? "error"}`);
    });
    pending.add(promise);
    promise.finally(() => pending.delete(promise));
}

export async function flushRefundEmails() {
    while (pending.size) await Promise.allSettled([...pending]);
}

// What one refund's email reports: the payment's captured amount and the
// total refunded up to and including this refund (fixed per refund, so a
// resend says the same). null when the payment's captured amount is unknown.
async function refundEmailTotals(refund) {
    const order = refund.orderId
        ? await prisma.order.findUnique({ where: { id: refund.orderId }, select: { razorpayPaymentId: true, total: true, currency: true } })
        : null;
    let captured = null;

    if (order?.razorpayPaymentId === refund.razorpayPaymentId) {
        captured = { amount: toMinorUnits(order.total, order.currency), currency: order.currency };
    } else {
        const unapplied = await prisma.unappliedPayment.findUnique({ where: { razorpayPaymentId: refund.razorpayPaymentId }, select: { amount: true, currency: true } });
        if (unapplied) captured = { amount: unapplied.amount, currency: unapplied.currency };
    }

    if (!captured || captured.currency !== refund.currency) return null;

    const { _sum } = await prisma.razorpayRefund.aggregate({
        where: { razorpayPaymentId: refund.razorpayPaymentId, currency: refund.currency, id: { lte: refund.id } },
        _sum: { amount: true },
    });
    const refundedSoFar = Number(_sum.amount ?? 0);

    return { capturedAmount: captured.amount, refundedSoFar, full: refundedSoFar >= captured.amount };
}

// Records a send the provider accepted. Never overwrites a recorded send
// (emailSentAt IS NULL in the UPDATE), whoever owns the claim: a real send
// is always safe to record, even by a sender that lost its claim. -> true
// if this call recorded it.
async function recordSent(id, at) {
    const { count } = await prisma.razorpayRefund.updateMany({
        where: { id, emailSentAt: null },
        data: { emailSentAt: at, emailLastError: null },
    });
    return count === 1;
}

// Claims one refund row and tries its email once. -> "sent", "failed",
// "gave_up", "no_recipient", "skipped" (claimed by another sender) or
// "lost_claim" (this sender's claim expired and another sender owns the row,
// or already recorded it sent: nothing of theirs is overwritten).
//
// Fencing: the claim's emailLockedUntil value is this sender's token. Every
// write after sending (retry, give-up, no-recipient, releasing the claim) is
// conditional on that exact value and on emailSentAt still being NULL, so a
// sender that outlived its claim can never overwrite the newer owner's state.
// The attempt (preparing and sending) is cut off after sendTimeoutMs, well
// inside the claim, so normally a claim never expires mid-send. Any error or
// timeout counts as a failed attempt: retried after the backoff, given up
// after EMAIL_MAX_ATTEMPTS. A send that the provider accepts after its
// timeout is still recorded (recordSent), so it is not sent again later.
async function deliverOneRefundEmail(id, now, sendTimeoutMs) {
    const claimedAt = now();
    const claimUntil = new Date(claimedAt.getTime() + EMAIL_CLAIM_MS);
    const { count } = await prisma.razorpayRefund.updateMany({
        where: {
            id, emailSentAt: null, emailDueAt: { lte: claimedAt },
            OR: [{ emailLockedUntil: null }, { emailLockedUntil: { lt: claimedAt } }],
        },
        data: { emailLockedUntil: claimUntil, emailAttempts: { increment: 1 } },
    });

    if (count === 0) return "skipped";

    const refund = await prisma.razorpayRefund.findUnique({ where: { id } });
    let result;
    let error = "SEND_FAILED";

    const attempt = (async () => deliverRefundEmail(refund, await refundEmailTotals(refund)))();
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve("timeout"), sendTimeoutMs);
        timer.unref?.();
    });

    try {
        result = await Promise.race([attempt, timeout]);
    } catch (err) {
        result = "failed";
        error = "PREPARE_FAILED";
        console.error(`Refund email could not be prepared ${JSON.stringify({ razorpayRefundId: refund.razorpayRefundId, error: err?.code ?? err?.name ?? "error" })}`);
    } finally {
        clearTimeout(timer);
    }

    if (result === "timeout") {
        result = "failed";
        error = "SEND_TIMEOUT";
        console.error(`Refund email send timed out ${JSON.stringify({ razorpayRefundId: refund.razorpayRefundId, timeoutMs: sendTimeoutMs })}`);
        // The send may still be accepted later: record it then.
        const late = attempt.then(
            async (outcome) => {
                if (outcome === "sent" && await recordSent(id, now())) {
                    console.warn(`Refund email accepted after its timeout ${JSON.stringify({ razorpayRefundId: refund.razorpayRefundId })}`);
                }
            },
            () => {},
        ).catch((err) => console.error(`Refund email late result not recorded: ${err?.code ?? err?.name ?? "error"}`));
        pending.add(late);
        late.finally(() => pending.delete(late));
    }

    const doneAt = now();

    if (result === "sent") {
        const recorded = await recordSent(id, doneAt);
        // Release our claim (only if still ours).
        await prisma.razorpayRefund.updateMany({ where: { id, emailLockedUntil: claimUntil }, data: { emailLockedUntil: null } });
        if (recorded) return "sent";
        lostClaim(refund, "sent", "already recorded sent by another sender");
        return "lost_claim";
    }

    let data;
    let outcome;

    if (result === "no_recipient") {
        data = { emailDueAt: null, emailLockedUntil: null, emailLastError: "NO_RECIPIENT" };
        outcome = "no_recipient";
    } else if (refund.emailAttempts >= EMAIL_MAX_ATTEMPTS) {
        data = { emailDueAt: null, emailLockedUntil: null, emailLastError: "GAVE_UP" };
        outcome = "gave_up";
    } else {
        data = { emailDueAt: new Date(doneAt.getTime() + backoffMs(refund.emailAttempts)), emailLockedUntil: null, emailLastError: error };
        outcome = "failed";
    }

    // Fenced: only while this sender still owns the claim and nothing was sent.
    const { count: owned } = await prisma.razorpayRefund.updateMany({
        where: { id, emailLockedUntil: claimUntil, emailSentAt: null },
        data,
    });

    if (!owned) {
        lostClaim(refund, outcome, "claim expired and taken over, or sent meanwhile");
        return "lost_claim";
    }

    if (outcome === "gave_up") {
        console.error(`Refund email abandoned after ${refund.emailAttempts} attempts ${JSON.stringify({ razorpayRefundId: refund.razorpayRefundId })}`);
    }

    return outcome;
}

function lostClaim(refund, result, reason) {
    console.warn(`Refund email claim lost ${JSON.stringify({ event: "refund_email_claim_lost", razorpayRefundId: refund.razorpayRefundId, result, reason })}`);
}

// Sends the due refund emails (all due ones, or only `ids`). -> counts.
export async function deliverDueRefundEmails({ now = () => new Date(), ids, limit = EMAIL_BATCH_SIZE, sendTimeoutMs = EMAIL_SEND_TIMEOUT_MS } = {}) {
    const counts = { sent: 0, failed: 0, gave_up: 0, no_recipient: 0, skipped: 0, lost_claim: 0 };
    const at = now();

    const due = await prisma.razorpayRefund.findMany({
        where: {
            emailSentAt: null,
            emailDueAt: { lte: at },
            OR: [{ emailLockedUntil: null }, { emailLockedUntil: { lt: at } }],
            ...(ids && { id: { in: ids } }),
        },
        orderBy: { emailDueAt: "asc" },
        take: limit,
        select: { id: true },
    });

    // Each refund on its own: an error with one never stops the rest.
    for (const { id } of due) {
        try {
            counts[await deliverOneRefundEmail(id, now, sendTimeoutMs)] += 1;
        } catch (err) {
            // Could not even record the outcome (e.g. the database is down):
            // the claim expires and the next run tries again.
            counts.failed += 1;
            console.error(`Refund email processing failed for refund row ${id}: ${err?.code ?? err?.name ?? "error"}`);
        }
    }

    return counts;
}

// Admin: sends an exhausted (GAVE_UP) refund email again. One conditional
// UPDATE does it all, so of concurrent requests exactly one resets the row;
// the others match nothing and get 409. The row must be this order's refund,
// never sent, and given up (not still pending or retrying: those would be
// sent anyway). It gets a fresh set of attempts, is due now, records who asked
// and when, and is then delivered through the normal claim, so a worker
// running at the same time cannot send it twice.
export async function resendRefundEmail(orderId, razorpayRefundId, adminId) {
    const now = new Date();
    const { count } = await prisma.razorpayRefund.updateMany({
        where: { razorpayRefundId, orderId, emailSentAt: null, emailDueAt: null, emailLastError: "GAVE_UP" },
        data: {
            emailDueAt: now, emailAttempts: 0, emailLastError: null, emailLockedUntil: null,
            emailResendRequestedAt: now, emailResendRequestedById: adminId,
        },
    });

    const row = await prisma.razorpayRefund.findUnique({
        where: { razorpayRefundId },
        select: { id: true, orderId: true, emailSentAt: true, emailLastError: true },
    });

    if (!row || row.orderId !== orderId) throw new ApiError(404, "Refund not found for this order");

    if (count === 0) {
        throw new ApiError(409, row.emailSentAt
            ? "This refund's email has already been sent"
            : "Only a refund email whose retries are exhausted can be resent");
    }

    console.log(`Refund email resend requested ${JSON.stringify({ event: "refund_email_resend_requested", razorpayRefundId, orderId, adminId })}`);

    queueRefundEmails([row.id]);
}

/*
|--------------------------------------------------------------------------
| Refund worker
|--------------------------------------------------------------------------
| Every REFUND_SWEEP_INTERVAL_MS: settle refunds still waiting for a match
| (repairs a crash between a capture and its settle, and matches a refund
| that arrived before its payment was known), then send due emails. Safe in
| several instances: settling locks, and each email is claimed before sending.
| REFUND_WORKER=false turns it off in this instance.
*/

export const REFUND_SWEEP_INTERVAL_MS = 60 * 1000;
// Refunds older than this that never matched are left alone (logged once per sweep count).
export const PENDING_MATCH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PENDING_BATCH_SIZE = 50;

export async function sweepRefunds({ now = new Date() } = {}) {
    const counts = { settled: 0, pending: 0, failed: 0 };

    // Most recently received first, so refunds that never match (e.g. for
    // payments this shop does not know) cannot crowd out new ones.
    const waiting = await prisma.razorpayRefund.groupBy({
        by: ["razorpayPaymentId"],
        where: { settledAt: null, receivedAt: { gte: new Date(now.getTime() - PENDING_MATCH_WINDOW_MS) } },
        _max: { receivedAt: true },
        orderBy: { _max: { receivedAt: "desc" } },
        take: PENDING_BATCH_SIZE,
    });

    for (const { razorpayPaymentId } of waiting) {
        try {
            const { outcome } = await settleRefundsForPayment(razorpayPaymentId);
            counts[outcome === "refund_pending_match" ? "pending" : "settled"] += 1;
        } catch (err) {
            counts.failed += 1;
            console.error(`Refund settle failed for ${razorpayPaymentId}: ${err?.code ?? err?.name ?? "error"}`);
        }
    }

    const emails = await deliverDueRefundEmails({ now: () => new Date() });

    if (counts.settled || counts.failed || emails.sent || emails.failed || emails.gave_up) {
        console.log(`Refund sweep ${JSON.stringify({ ...counts, emails })}`);
    }

    return { ...counts, emails };
}

export function startRefundWorker({ intervalMs = REFUND_SWEEP_INTERVAL_MS } = {}) {
    let timer = null;
    let running = null;
    let stopped = false;

    const tick = () => {
        running = sweepRefunds()
            .catch((err) => console.error(`Refund sweep failed: ${err?.code ?? err?.name ?? "error"}`))
            .finally(() => {
                running = null;
                if (!stopped) {
                    timer = setTimeout(tick, intervalMs);
                    timer.unref?.();
                }
            });
    };

    tick();

    return async function stop() {
        stopped = true;
        clearTimeout(timer);
        await running;
    };
}
