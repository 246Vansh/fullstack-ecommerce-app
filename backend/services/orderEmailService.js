import prisma from "../config/db.js";
import { sendMail, maskAddress } from "./mailService.js";
import { orderEmail, refundEmail } from "./mailTemplates.js";

/*
|--------------------------------------------------------------------------
| Order lifecycle emails
|--------------------------------------------------------------------------
| Queued, never awaited, by the code that just committed the change:
|   - notifyOrderEvent (notificationService), only when it created the
|     notification. The notification's unique dedupeKey ("order:{id}:{type}")
|     is what makes the email once-only: a repeated event, a retry or a
|     request that lost a race creates no notification, so sends no email.
|   Refund emails are not queued here: they go through the durable refund
|     outbox in refundService (at least once, one per refund), which calls
|     deliverRefundEmail.
|
| Never blocks or breaks the caller: everything (loading the order, building
| the message, sending) happens after the caller has moved on, and every
| failure is caught and logged with the order id and a masked address only.
| Order emails are not retried: one that fails is lost (the in-app
| notification, and the order itself, are unaffected). Refund emails are
| retried by the outbox.
|
| Which email an event sends:
|   ORDER_PLACED      COD orders: ORDER_CONFIRMED. Online orders: none (not
|                     paid yet; they are confirmed by their payment).
|   PAYMENT_RECEIVED  online orders: ORDER_PAID (one combined email).
|   ORDER_SHIPPED / ORDER_DELIVERED: the same kind.
|   ORDER_CANCELLED   reason "expired" (expiry worker): ORDER_EXPIRED;
|                     otherwise (customer): ORDER_CANCELLED.
|   ORDER_CONFIRMED / ORDER_PROCESSING: none.
*/

let send = sendMail;

// Test seam (like paymentService.setPaymentGateway): replaces sendMail;
// called with no argument, restores it.
export function setOrderMailSender(next) {
    send = next ?? sendMail;
}

// In-flight sends, so tests (and a graceful shutdown, if ever wanted) can wait for them.
const pending = new Set();

function track(promise) {
    pending.add(promise);
    promise.then(
        () => pending.delete(promise),
        () => pending.delete(promise)
    );
}

// Resolves once every queued email (including any queued while waiting) has settled.
export async function flushOrderEmails() {
    while (pending.size) await Promise.allSettled([...pending]);
}

export function emailKindFor(paymentMethod, type, reason) {
    switch (type) {
        case "ORDER_PLACED": return paymentMethod === "COD" ? "ORDER_CONFIRMED" : null;
        case "PAYMENT_RECEIVED": return paymentMethod === "RAZORPAY" ? "ORDER_PAID" : null;
        case "ORDER_SHIPPED":
        case "ORDER_DELIVERED": return type;
        case "ORDER_CANCELLED": return reason === "expired" ? "ORDER_EXPIRED" : "ORDER_CANCELLED";
        default: return null;
    }
}

// Deliberately simple: one @, no whitespace, angle brackets, quotes or
// separators, a dot in the domain. Anything else is not used as a recipient.
const EMAIL = /^[^\s@<>()[\]",;:\\]+@[^\s@<>()[\]",;:\\]+\.[^\s@<>()[\]",;:\\]+$/;
const isUsableEmail = (value) => typeof value === "string" && value.length <= 191 && EMAIL.test(value);

// The order's email snapshot (the account email when it was placed), or the
// account's current email when the snapshot is not usable.
export function recipientFor({ shippingEmail, user }) {
    const snapshot = shippingEmail?.trim();
    if (isUsableEmail(snapshot)) return snapshot;
    const current = user?.email?.trim();
    return isUsableEmail(current) ? current : null;
}

function orderLink(id) {
    const origin = process.env.CLIENT_URL?.trim().replace(/\/+$/, "");
    return origin ? `${origin}/orders/${id}` : null;
}

const orderEmailSelect = {
    id: true,
    orderNumber: true,
    paymentMethod: true,
    razorpayPaymentId: true,
    currency: true,
    subtotal: true,
    discount: true,
    couponCode: true,
    shipping: true,
    tax: true,
    total: true,
    shippingEmail: true,
    shippingFirstName: true,
    shippingLastName: true,
    shippingAddress: true,
    shippingApartment: true,
    shippingCity: true,
    shippingState: true,
    shippingZipCode: true,
    shippingCountry: true,
    user: { select: { email: true, firstName: true } },
    items: {
        select: { productName: true, size: true, color: true, quantity: true, unitPrice: true, lineTotal: true },
        orderBy: { id: "asc" },
    },
};

// Sends, logging a failure that the sender reports by throwing (sendMail
// itself never throws; it logs its own failures and resolves false).
async function deliver(to, message, label, orderId) {
    try {
        return await send({ to, ...message }, label);
    } catch (err) {
        console.error(`Failed to send ${label} email for order ${orderId} to ${maskAddress(to)}: ${err?.message ?? "unknown error"}`);
        return false;
    }
}

async function sendOrderEmail(orderId, type, reason) {
    const label = `order ${type}`;
    try {
        const order = await prisma.order.findUnique({ where: { id: orderId }, select: orderEmailSelect });
        if (!order) return false;

        const kind = emailKindFor(order.paymentMethod, type, reason);
        if (!kind) return false;

        const to = recipientFor(order);
        if (!to) {
            console.error(`No usable email address for ${kind} email of order ${orderId}; nothing sent`);
            return false;
        }

        const message = orderEmail(kind, {
            firstName: order.user?.firstName || order.shippingFirstName,
            orderNumber: order.orderNumber,
            currency: order.currency,
            subtotal: order.subtotal,
            discount: order.discount,
            couponCode: order.couponCode,
            shipping: order.shipping,
            tax: order.tax,
            total: order.total,
            paymentReference: order.razorpayPaymentId,
            link: orderLink(order.id),
            items: order.items,
            shippingAddress: {
                firstName: order.shippingFirstName,
                lastName: order.shippingLastName,
                address: order.shippingAddress,
                apartment: order.shippingApartment,
                city: order.shippingCity,
                state: order.shippingState,
                zipCode: order.shippingZipCode,
                country: order.shippingCountry,
            },
        });

        return await deliver(to, message, `order ${kind}`, orderId);
    } catch (err) {
        console.error(`Failed to prepare ${label} email for order ${orderId}: ${err?.code ?? err?.name ?? "unknown error"}`);
        return false;
    }
}

// One refund's email, sent by the refund outbox (refundService), which
// records the result: "sent" (accepted by the provider), "failed" (retried
// later) or "no_recipient" (nothing to retry). Never throws. totals: the
// payment's captured amount and the total refunded up to this refund, or null.
// The Message-ID is fixed per refund, so a resend after a crash carries the
// same id (many mail services then drop the second copy; not guaranteed).
export async function deliverRefundEmail(refund, totals) {
    let orderId = refund?.orderId ?? "unknown";
    try {
        const order = refund.orderId ? await prisma.order.findUnique({
            where: { id: refund.orderId },
            select: { id: true, orderNumber: true, shippingEmail: true, shippingFirstName: true, user: { select: { email: true, firstName: true } } },
        }) : null;
        if (!order) return "no_recipient";
        orderId = order.id;

        const to = recipientFor(order);
        if (!to) {
            console.error(`No usable email address for refund email of order ${orderId}; nothing sent`);
            return "no_recipient";
        }

        const message = refundEmail({
            firstName: order.user?.firstName || order.shippingFirstName,
            orderNumber: order.orderNumber,
            amount: refund.amount,
            currency: refund.currency,
            refundId: refund.razorpayRefundId,
            totals,
            link: orderLink(order.id),
        });

        const sent = await deliver(to, { ...message, messageId: refundMessageId(refund.razorpayRefundId) }, "refund processed", orderId);
        return sent ? "sent" : "failed";
    } catch (err) {
        console.error(`Failed to prepare refund processed email for order ${orderId}: ${err?.code ?? err?.name ?? "unknown error"}`);
        return "failed";
    }
}

// <refund.rfnd_x@host>: the host of MAIL_FROM's address, else CLIENT_URL's.
function refundMessageId(refundId) {
    const from = /@([A-Za-z0-9.-]+)>?\s*$/.exec(process.env.MAIL_FROM ?? "")?.[1];
    let host = from;
    if (!host) {
        try { host = new URL(process.env.CLIENT_URL).hostname; } catch { host = "localhost"; }
    }
    return `<refund.${refundId}@${host}>`;
}

// Fire-and-forget entry points. Never throw, never block the caller.
export function queueOrderEmail(orderId, type, { reason } = {}) {
    track(sendOrderEmail(orderId, type, reason));
}
