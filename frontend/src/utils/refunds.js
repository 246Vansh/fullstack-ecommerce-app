import { formatPrice } from "./money.js";

// Display helpers for the admin refund breakdown (GET /api/admin/orders/:id:
// paymentRefunds, refundReview, unappliedPayments[].refunds). The server
// decides every state; nothing here recalculates whether an order may ship.

// Minor units per major unit for the currencies Razorpay is used with
// (backend pricingService). Unknown currencies are shown as 2 decimals.
const MINOR_UNITS = { INR: 2, USD: 2 };

// An amount in minor units (cents, paise), as Razorpay reports it.
export function formatMinor(amount, currency) {
    const exponent = MINOR_UNITS[currency] ?? 2;
    return formatPrice(Number(amount) / 10 ** exponent, currency);
}

export const REFUND_STATE_LABELS = {
    NONE: "No refunds counted",
    PARTIAL: "Partially refunded",
    FULL: "Fully refunded",
};

export const REFUND_ANOMALY_LABELS = {
    CURRENCY_MISMATCH: "A refund is in a different currency from the payment; it is not counted.",
    OVER_REFUNDED: "More has been refunded than was captured. Check the payment in the Razorpay dashboard.",
};

export const REFUND_EMAIL_LABELS = {
    SENT: "Email sent",
    PENDING: "Email pending",
    RETRYING: "Email failed; retrying",
    NO_RECIPIENT: "No email address to send to",
    GAVE_UP: "Email failed; retries exhausted",
    WAITING_FOR_MATCH: "Waiting for its payment",
};

// The figures for one payment's refunds, ready to show: captured, refunded and
// net (formatted), state label and anomaly messages.
export function refundSummaryRows(view) {
    if (!view) return null;

    return {
        captured: formatMinor(view.capturedAmount, view.currency),
        refunded: formatMinor(view.refundedAmount, view.currency),
        net: formatMinor(view.netRetained, view.currency),
        state: REFUND_STATE_LABELS[view.refundState] ?? view.refundState,
        anomalies: (view.anomalies ?? []).map((code) => REFUND_ANOMALY_LABELS[code] ?? code),
    };
}

// One line per refund record.
export function refundRecordRows(view) {
    return (view?.refunds ?? []).map((refund) => ({
        id: refund.razorpayRefundId,
        amount: formatMinor(refund.amount, refund.currency),
        counted: refund.counted,
        receivedAt: refund.receivedAt,
        email: REFUND_EMAIL_LABELS[refund.emailStatus] ?? refund.emailStatus,
        // Retries used up: an admin may ask for it to be sent again.
        resendable: refund.emailStatus === "GAVE_UP",
    }));
}

// The exact state an admin acknowledges (sent back unchanged; the server
// refuses it if a refund arrived since the page was loaded).
export function acknowledgementFor(view) {
    return { refundCount: view.refundCount, refundedAmount: view.refundedAmount };
}
