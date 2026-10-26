import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { expireOrder, RESERVATION_MINUTES, RESERVATION_MS, UNPAID_PAYMENT_STATUSES } from "./orderService.js";
import { assessOrderPayments, isOnlinePaymentEnabled, reconcilePaymentState, reconcileRecentPayments } from "./paymentService.js";
import { createdCutoffMs, DEFAULT_CREATED_CUTOFF } from "../config/reservations.js";

/*
|--------------------------------------------------------------------------
| Reservation expiry worker
|--------------------------------------------------------------------------
| An unpaid online order holds its stock until reservationExpiresAt (30
| minutes after it was placed, see orderService). Every SWEEP_INTERVAL_MS the
| worker finds orders past that deadline, oldest first, in batches, and for
| each one:
|
| 1. If it has a Razorpay order, asks Razorpay about its payments first
|    (outside any transaction): a captured payment pays the order instead of
|    expiring it. A payment still in flight (created, authorized, or a status
|    not recognised), or an answer that is missing or incomplete (Razorpay
|    unreachable, a malformed or partial list), leaves it reserved for the
|    next sweep. Only "no payment" or "every payment failed or was refunded"
|    lets it expire. Without Razorpay keys such orders are left alone.
|    Exception, the created-payment cutoff: when every open payment is
|    "created" (nothing authorized, captured or unrecognised) and the order is
|    RESERVATION_CREATED_CUTOFF (default 2h, at most 24h) past its deadline,
|    it expires too; a later capture is handled as a late payment.
| 2. Expires it with expireOrder(): one transaction whose conditional UPDATE
|    re-checks every condition on the committed row, then gives the stock
|    back. A payment or a customer cancellation that got there first makes
|    it match 0 rows, and nothing changes.
|
| Late-payment check: for LATE_CHECK_WINDOW_MS after an order expired, while
| it has a Razorpay order and no payment recorded for a refund, the worker
| asks Razorpay again (at most every LATE_CHECK_EVERY_MS per order and process,
| LATE_CHECK_BATCH_SIZE orders per sweep). A capture found then is applied
| like any late payment: the order is reinstated, or the payment recorded for
| a refund. This catches late payments without the webhook, and retries one
| whose recording failed (e.g. the database was briefly unavailable).
|
| Every RECONCILE_EVERY_MS the worker also reconciles with Razorpay's list of
| payments for the last four days (paymentService.reconcileRecentPayments),
| which covers what the two checks above cannot: payments after the webhook
| stopped retrying, after the 24-hour window, or for customer-cancelled orders.
|
| Online orders without a deadline (placed by older code during a deploy) get
| one RESERVATION_MINUTES from when the worker first sees them; they are never
| cancelled on sight.
|
| The timer runs in every app instance that starts it. Instances may sweep at
| the same time: step 2's conditional UPDATE lets exactly one of them expire
| an order, so stock is returned once. Set RESERVATION_EXPIRY_WORKER=false to
| run it in fewer instances (at least one must run it). Nothing is held in
| memory between sweeps; after a restart the next sweep finds every order
| that is due from the database.
*/

export const SWEEP_INTERVAL_MS = 60 * 1000;
export const SWEEP_BATCH_SIZE = 50;
// Bounds one sweep; anything left is picked up by the next one.
export const SWEEP_MAX_BATCHES = 10;

// How often the worker reconciles with Razorpay's payment list.
export const RECONCILE_EVERY_MS = 60 * 60 * 1000;

// Online orders found without a deadline (placed by a version without
// reservations, e.g. during a deployment gap) at most this many per sweep.
export const MISSING_DEADLINE_BATCH_SIZE = 100;

export const LATE_CHECK_WINDOW_MS = 24 * 60 * 60 * 1000;
export const LATE_CHECK_EVERY_MS = 15 * 60 * 1000;
export const LATE_CHECK_BATCH_SIZE = 20;

// An order kept this long after its deadline (payment still in flight) is logged.
const KEPT_OVERDUE_LOG_MS = 60 * 60 * 1000;

// Process-local throttles (lost on restart, which only means an earlier check).
const lateCheckedAt = new Map();
const keptLoggedAt = new Map();

const forget = (map, now, ttl) => {
    for (const [id, at] of map) if (now - at > ttl) map.delete(id);
};

const dueWhere = (now) => ({
    paymentMethod: "RAZORPAY",
    status: "PENDING",
    paymentStatus: { in: UNPAID_PAYMENT_STATUSES },
    reservationExpiresAt: { lte: now },
});

const candidateSelect = {
    id: true, userId: true, orderNumber: true, status: true, paymentStatus: true, paymentMethod: true,
    total: true, currency: true, razorpayOrderId: true, razorpayPaymentId: true, reservationExpiresAt: true, expiredAt: true,
};

// "expired", "paid", "kept" (payment in flight, Razorpay unreachable, or no
// keys to ask with) or "skipped" (no longer due: paid or cancelled meanwhile).
async function processOrder(order, now) {
    if (order.razorpayOrderId) {
        if (!isOnlinePaymentEnabled()) return "kept";

        let state;
        let cutoffEligible = false;
        try {
            ({ state, cutoffEligible } = await assessOrderPayments(order));
        } catch (err) {
            // 502: Razorpay unreachable or its list incomplete, try again next
            // sweep. 409: a payment was refused and reported for a refund; the
            // order itself can expire.
            if (!(err instanceof ApiError)) throw err;
            if (err.statusCode !== 409) return "kept";
            state = "UNPAID";
        }

        if (state === "PAID") return "paid";
        if (state === "PROCESSING") {
            // Only "created" payments (nothing authorized, captured or unknown)
            // past the cutoff: released like any expiry. A capture that comes
            // later is a late payment (reinstated, or recorded for a refund).
            if (cutoffEligible && now.getTime() >= order.reservationExpiresAt.getTime() + createdCutoff()) {
                if (!(await expireOrder(order.id, now))) return "skipped";
                console.warn(`Reservation released after the created-payment cutoff: order ${order.orderNumber}, ${Math.floor((now.getTime() - order.reservationExpiresAt.getTime()) / 60000)} minutes past its deadline`);
                return "cutoff_expired";
            }
            logKeptOverdue(order, now);
            return "kept";
        }
    }

    return (await expireOrder(order.id, now)) ? "expired" : "skipped";
}

// RESERVATION_CREATED_CUTOFF in milliseconds (validated at startup; read on
// every sweep).
const createdCutoff = () => createdCutoffMs(process.env.RESERVATION_CREATED_CUTOFF) ?? createdCutoffMs(DEFAULT_CREATED_CUTOFF);

// Online orders that are still pending and unpaid but have no deadline were
// placed by code without reservations (the migration gave every older one
// createdAt + 30 minutes). They are not cancelled here: each gets a full
// RESERVATION_MINUTES from now, is logged, and then expires (or is paid) by
// the normal rules on a later sweep. The update only fills a missing
// deadline, so several instances, or a rerun, assign it once.
async function assignMissingDeadlines(now, counts) {
    const missing = await prisma.order.findMany({
        where: { paymentMethod: "RAZORPAY", status: "PENDING", paymentStatus: { in: UNPAID_PAYMENT_STATUSES }, reservationExpiresAt: null },
        select: { id: true, orderNumber: true },
        orderBy: { id: "asc" },
        take: MISSING_DEADLINE_BATCH_SIZE,
    });

    if (!missing.length) return;

    const { count } = await prisma.order.updateMany({
        where: { id: { in: missing.map((o) => o.id) }, reservationExpiresAt: null },
        data: { reservationExpiresAt: new Date(now.getTime() + RESERVATION_MS) },
    });

    counts.deadline_assigned += count;
    console.warn(`Reservation deadline assigned to online orders that had none (${RESERVATION_MINUTES} minutes from now): ${JSON.stringify(missing.map((o) => o.orderNumber))}`);
}

// A payment that stays in flight long after the deadline keeps the stock
// reserved; say so (hourly per order) so someone can look at it in Razorpay.
function logKeptOverdue(order, now) {
    const overdue = now.getTime() - order.reservationExpiresAt.getTime();
    const last = keptLoggedAt.get(order.id);

    if (overdue < KEPT_OVERDUE_LOG_MS || (last !== undefined && now.getTime() - last < KEPT_OVERDUE_LOG_MS)) return;

    keptLoggedAt.set(order.id, now.getTime());
    console.warn(`Reservation kept: order ${order.orderNumber} is ${Math.floor(overdue / 60000)} minutes past its deadline with a Razorpay payment still in flight`);
}

// Expired orders that may still receive (or have received) a late capture.
// -> "late_paid" (reinstated), "late_refund_due" (recorded for a refund),
// "late_none" (nothing captured) or "late_kept" (Razorpay unreachable).
async function checkLatePayment(order) {
    let state;
    try {
        state = await reconcilePaymentState(order);
    } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        // 409: refused, with the payment recorded for a refund.
        return err.statusCode === 409 ? "late_refund_due" : "late_kept";
    }

    return state === "PAID" ? "late_paid" : "late_none";
}

async function checkLatePayments(now, counts, { batchSize, everyMs }) {
    if (!isOnlinePaymentEnabled()) return;

    forget(lateCheckedAt, now.getTime(), LATE_CHECK_WINDOW_MS + everyMs);

    const recent = await prisma.order.findMany({
        where: {
            paymentMethod: "RAZORPAY",
            status: "CANCELLED",
            paymentStatus: { in: UNPAID_PAYMENT_STATUSES },
            razorpayOrderId: { not: null },
            expiredAt: { gte: new Date(now.getTime() - LATE_CHECK_WINDOW_MS), lte: now },
            unappliedPayments: { none: {} },
        },
        select: candidateSelect,
        orderBy: [{ expiredAt: "asc" }, { id: "asc" }],
        // Room to skip the ones checked recently.
        take: batchSize * 5,
    });

    const due = recent.filter((order) => {
        const last = lateCheckedAt.get(order.id);
        return last === undefined || now.getTime() - last >= everyMs;
    }).slice(0, batchSize);

    for (const order of due) {
        lateCheckedAt.set(order.id, now.getTime());
        try {
            counts[await checkLatePayment(order)] += 1;
        } catch (err) {
            counts.failed += 1;
            console.error(`Late payment check failed for order ${order.orderNumber}: ${err?.code ?? err?.name ?? "error"}`);
        }
    }
}

// One sweep; returns the counts. `now`, the sizes and the late-check interval are for tests.
export async function expireReservations({
    now = new Date(), batchSize = SWEEP_BATCH_SIZE, maxBatches = SWEEP_MAX_BATCHES,
    lateCheckBatchSize = LATE_CHECK_BATCH_SIZE, lateCheckEveryMs = LATE_CHECK_EVERY_MS,
} = {}) {
    const counts = {
        expired: 0, paid: 0, kept: 0, skipped: 0, failed: 0, late_paid: 0, late_refund_due: 0, late_none: 0, late_kept: 0,
        deadline_assigned: 0, cutoff_expired: 0,
    };
    forget(keptLoggedAt, now.getTime(), 2 * KEPT_OVERDUE_LOG_MS);

    await assignMissingDeadlines(now, counts);
    // Orders this sweep has already looked at and left as they were.
    const seen = new Set();

    for (let batch = 0; batch < maxBatches; batch++) {
        const orders = await prisma.order.findMany({
            where: { ...dueWhere(now), ...(seen.size && { id: { notIn: [...seen] } }) },
            select: candidateSelect,
            orderBy: [{ reservationExpiresAt: "asc" }, { id: "asc" }],
            take: batchSize,
        });

        for (const order of orders) {
            seen.add(order.id);
            try {
                counts[await processOrder(order, now)] += 1;
            } catch (err) {
                counts.failed += 1;
                console.error(`Reservation expiry failed for order ${order.orderNumber}: ${err?.code ?? err?.name ?? "error"}`);
            }
        }

        if (orders.length < batchSize) break;
    }

    await checkLatePayments(now, counts, { batchSize: lateCheckBatchSize, everyMs: lateCheckEveryMs });

    if (counts.expired || counts.cutoff_expired || counts.paid || counts.failed || counts.late_paid || counts.late_refund_due) {
        console.log(`Reservation expiry sweep ${JSON.stringify(counts)}`);
    }

    return counts;
}

// Starts the periodic sweep (the first one right away). Returns stop(), which
// cancels the timer and resolves once a sweep in progress has finished.
export function startReservationExpiryWorker({ intervalMs = SWEEP_INTERVAL_MS, reconcileEveryMs = RECONCILE_EVERY_MS } = {}) {
    let timer = null;
    let running = null;
    let stopped = false;

    // Reconciliation with Razorpay's payment list runs on the first tick, then
    // every RECONCILE_EVERY_MS (see paymentService.reconcileRecentPayments).
    let lastReconcile = -Infinity;

    const sweepAndReconcile = async () => {
        await expireReservations();

        if (Date.now() - lastReconcile >= reconcileEveryMs) {
            lastReconcile = Date.now();
            await reconcileRecentPayments();
        }
    };

    const tick = () => {
        running = sweepAndReconcile()
            .catch((err) => console.error(`Reservation expiry sweep failed: ${err?.code ?? err?.name ?? "error"}`))
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
