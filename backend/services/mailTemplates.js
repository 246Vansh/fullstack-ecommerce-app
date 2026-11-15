// Email bodies. Each returns { subject, text, html }: the text part is the
// complete message for clients that do not render HTML.
//
// Every value that came from a user or the database is passed through
// escapeHtml before it goes into the HTML part.

const BRAND_COLOR = "#285943";
const MUTED_COLOR = "#52606d";

const appName = () => process.env.APP_NAME || "E-Commerce";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);

// 86400000 -> "24 hours", 1800000 -> "30 minutes".
export function formatDuration(ms) {
    const minutes = Math.round(ms / 60_000);
    if (minutes % 60 !== 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
}

// The shared HTML shell: brand header bar, white card, `body` inside it.
// Tables and inline styles: many email clients ignore <style> and flexbox.
function layout({ subject, body }) {
    const n = escapeHtml(appName());

    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f4;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f4;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:${BRAND_COLOR};padding:20px 32px;color:#ffffff;font-size:20px;font-weight:bold;">${n}</td></tr>
<tr><td style="padding:32px;">
${body}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function verificationEmail({ firstName, link, lifetimeMs }) {
    const name = appName();
    const validFor = formatDuration(lifetimeMs);
    const subject = `Verify your email address for ${name}`;

    const text = `Hi ${firstName},

Thanks for creating an account with ${name}. Confirm your email address by opening this link:
${link}

This link expires in ${validFor} and can be used once.

If you did not create an account, you can safely ignore this email.

— The ${name} team`;

    const n = escapeHtml(name);
    const href = escapeHtml(link);

    const html = layout({ subject, body: `<h1 style="margin:0 0 16px;font-size:22px;">Verify your email address</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(firstName)},</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">Thanks for creating an account with ${n}. Please confirm that this is your email address.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background:${BRAND_COLOR};">
<a href="${href}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">Verify Email</a>
</td></tr></table>
<p style="margin:24px 0 8px;font-size:13px;line-height:1.6;color:${MUTED_COLOR};">Button not working? Copy and paste this link into your browser:</p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${href}" style="color:${BRAND_COLOR};">${href}</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${MUTED_COLOR};">This link expires in ${validFor} and can be used once.</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED_COLOR};">If you did not create an account, you can safely ignore this email.</p>` });

    return { subject, text, html };
}

/*
|--------------------------------------------------------------------------
| Order emails
|--------------------------------------------------------------------------
| Built only from the stored order snapshot (names, prices and totals as they
| were when the order was placed), never from live catalog data.
*/

// 1234.5, "INR" -> "₹1,234.50"; an unknown currency code falls back to "1234.50 XYZ".
export function formatMoney(value, currency) {
    const amount = Number(value);
    try {
        return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency }).format(amount);
    } catch {
        return `${amount.toFixed(2)} ${currency}`;
    }
}

// Razorpay amounts are integers in the currency's minor units (paise, cents).
export function fromMinorUnits(amount, currency) {
    let digits = 2;
    try {
        digits = new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
    } catch { /* unknown code: assume 2 */ }
    return amount / 10 ** digits;
}

const variantLabel = ({ size, color }) => [size && `Size ${size}`, color].filter(Boolean).join(" · ");

const isPositive = (value) => Number(value) > 0;

// [label, formatted amount] rows for the totals block.
function totalRows(order) {
    const money = (value) => formatMoney(value, order.currency);
    const rows = [["Subtotal", money(order.subtotal)]];
    if (isPositive(order.discount)) rows.push([order.couponCode ? `Discount (${order.couponCode})` : "Discount", `−${money(order.discount)}`]);
    rows.push(["Shipping", isPositive(order.shipping) ? money(order.shipping) : "Free"]);
    if (isPositive(order.tax)) rows.push(["Tax", money(order.tax)]);
    return rows;
}

function addressLines(order) {
    const a = order.shippingAddress;
    return [
        `${a.firstName} ${a.lastName}`.trim(),
        a.address,
        a.apartment,
        [a.city, a.state, a.zipCode].filter(Boolean).join(", "),
        a.country,
    ].filter(Boolean);
}

// Per email: subject, heading, the paragraphs above the order, and which
// sections to show. `o` is the order data passed to orderEmail().
const ORDER_EMAILS = {
    ORDER_CONFIRMED: {
        subject: (o) => `Order confirmed — ${o.orderNumber}`,
        heading: "Thanks for your order",
        intro: (o) => [`We've received your order ${o.orderNumber} and it's confirmed.`],
        status: () => "Payment method: Cash on delivery. Please have the total ready when your order arrives.",
        items: true,
        address: true,
    },
    ORDER_PAID: {
        subject: (o) => `Order confirmed — payment received (${o.orderNumber})`,
        heading: "Order confirmed — payment received",
        intro: (o) => [`We've received your payment of ${formatMoney(o.total, o.currency)} and your order ${o.orderNumber} is confirmed.`],
        status: (o) => `Paid online${o.paymentReference ? ` · Payment reference ${o.paymentReference}` : ""}`,
        items: true,
        address: true,
    },
    ORDER_SHIPPED: {
        subject: (o) => `Your order ${o.orderNumber} has shipped`,
        heading: "Your order is on its way",
        intro: (o) => [`Good news! Your order ${o.orderNumber} has shipped and is on its way to you.`],
        status: () => "Status: Shipped",
        items: true,
        address: true,
    },
    ORDER_DELIVERED: {
        subject: (o) => `Your order ${o.orderNumber} has been delivered`,
        heading: "Your order has been delivered",
        intro: (o) => [`Your order ${o.orderNumber} has been delivered. We hope you enjoy it!`],
        status: () => "Status: Delivered",
        items: true,
        address: false,
    },
    ORDER_CANCELLED: {
        subject: (o) => `Your order ${o.orderNumber} has been cancelled`,
        heading: "Your order has been cancelled",
        intro: (o) => [`Your order ${o.orderNumber} has been cancelled as you requested.`],
        // Customers can cancel only orders with no payment recorded.
        status: () => "No payment was recorded for this order, so there is nothing to refund.",
        items: true,
        address: false,
    },
    ORDER_EXPIRED: {
        subject: (o) => `Order expired — payment not received (${o.orderNumber})`,
        heading: "Order expired — payment not received",
        intro: (o) => [
            `We didn't receive payment for your order ${o.orderNumber} before its payment deadline, so the order has been cancelled and its items released.`,
            "If you still want these items, you're welcome to place a new order.",
        ],
        status: () => "If you completed a payment for this order, please don't pay again. Contact our support team with your order number.",
        items: true,
        address: false,
    },
};

export const ORDER_EMAIL_KINDS = Object.keys(ORDER_EMAILS);

const P = "margin:0 0 16px;font-size:15px;line-height:1.6;";
const SMALL = `font-size:13px;line-height:1.6;color:${MUTED_COLOR};`;

function buttonHtml(href, label) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border-radius:6px;background:${BRAND_COLOR};">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function itemsHtml(order) {
    const money = (value) => formatMoney(value, order.currency);
    const rows = order.items.map((item) => {
        const variant = variantLabel(item);
        return `<tr>
<td style="padding:10px 0;border-bottom:1px solid #e4e7eb;font-size:14px;line-height:1.5;">${escapeHtml(item.productName)}${variant ? `<br><span style="${SMALL}">${escapeHtml(variant)}</span>` : ""}<br><span style="${SMALL}">Qty ${escapeHtml(item.quantity)} × ${escapeHtml(money(item.unitPrice))}</span></td>
<td align="right" style="padding:10px 0;border-bottom:1px solid #e4e7eb;font-size:14px;white-space:nowrap;vertical-align:top;">${escapeHtml(money(item.lineTotal))}</td>
</tr>`;
    }).join("\n");

    const totals = totalRows(order).map(([label, value]) => `<tr><td style="padding:4px 0;${SMALL}">${escapeHtml(label)}</td><td align="right" style="padding:4px 0;font-size:14px;white-space:nowrap;">${escapeHtml(value)}</td></tr>`).join("\n");

    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
${rows}
${totals}
<tr><td style="padding:10px 0 0;font-size:15px;font-weight:bold;border-top:1px solid #e4e7eb;">Total (${escapeHtml(order.currency)})</td><td align="right" style="padding:10px 0 0;font-size:15px;font-weight:bold;white-space:nowrap;border-top:1px solid #e4e7eb;">${escapeHtml(money(order.total))}</td></tr>
</table>`;
}

function itemsText(order) {
    const money = (value) => formatMoney(value, order.currency);
    const lines = order.items.map((item) => {
        const variant = variantLabel(item);
        return `- ${item.productName}${variant ? ` (${variant})` : ""}: ${item.quantity} × ${money(item.unitPrice)} = ${money(item.lineTotal)}`;
    });
    const totals = totalRows(order).map(([label, value]) => `${label}: ${value}`);
    return [...lines, "", ...totals, `Total (${order.currency}): ${money(order.total)}`].join("\n");
}

/*
| kind: one of ORDER_EMAIL_KINDS. order: {
|   firstName, orderNumber, currency, subtotal, discount, couponCode, shipping,
|   tax, total, paymentReference?, link? (order details page),
|   items: [{ productName, size, color, quantity, unitPrice, lineTotal }],
|   shippingAddress: { firstName, lastName, address, apartment, city, state, zipCode, country },
| }
*/
export function orderEmail(kind, order) {
    const spec = ORDER_EMAILS[kind];
    if (!spec) throw new Error(`unknown order email kind: ${kind}`);

    const name = appName();
    const subject = spec.subject(order);
    const intro = spec.intro(order);
    const status = spec.status(order);
    const address = spec.address ? addressLines(order) : [];

    const text = [
        `Hi ${order.firstName},`,
        "",
        ...intro.flatMap((line) => [line, ""]),
        status,
        "",
        `Order ${order.orderNumber}`,
        ...(spec.items ? [itemsText(order), ""] : []),
        ...(address.length ? ["Shipping to:", ...address, ""] : []),
        ...(order.link ? [`View your order: ${order.link}`, ""] : []),
        `— The ${name} team`,
    ].join("\n");

    const html = layout({ subject, body: [
        `<h1 style="margin:0 0 16px;font-size:22px;">${escapeHtml(spec.heading)}</h1>`,
        `<p style="${P}">Hi ${escapeHtml(order.firstName)},</p>`,
        ...intro.map((line) => `<p style="${P}">${escapeHtml(line)}</p>`),
        `<p style="margin:0 0 24px;padding:12px 16px;background:#f4f5f4;border-radius:6px;font-size:14px;line-height:1.6;">${escapeHtml(status)}</p>`,
        `<h2 style="margin:0 0 8px;font-size:16px;">Order ${escapeHtml(order.orderNumber)}</h2>`,
        ...(spec.items ? [itemsHtml(order)] : []),
        ...(address.length ? [`<p style="margin:0 0 4px;font-size:14px;font-weight:bold;">Shipping to</p>
<p style="margin:0 0 24px;${SMALL}">${address.map(escapeHtml).join("<br>")}</p>`] : []),
        ...(order.link ? [buttonHtml(order.link, "View Order")] : []),
        `<p style="margin:0;${SMALL}">— The ${escapeHtml(name)} team</p>`,
    ].join("\n") });

    return { subject, text, html };
}

/*
| A refund Razorpay has reported as processed. amount and currency are the
| refund's own (minor units, as Razorpay reports them); nothing is computed
| from the order. { firstName, orderNumber, amount, currency, refundId, link? }
*/
export function refundEmail({ firstName, orderNumber, amount, currency, refundId, link }) {
    const name = appName();
    const refunded = formatMoney(fromMinorUnits(amount, currency), currency);
    const subject = `Refund processed for order ${orderNumber}`;
    const intro = `Your refund of ${refunded} for a payment made on order ${orderNumber} has been processed.`;
    const timing = "Depending on your bank or card issuer, it can take a few business days to appear on your statement.";
    const reference = `Refund reference: ${refundId}`;

    const text = [
        `Hi ${firstName},`,
        "",
        intro,
        "",
        timing,
        "",
        reference,
        "",
        ...(link ? [`View your order: ${link}`, ""] : []),
        `— The ${name} team`,
    ].join("\n");

    const html = layout({ subject, body: [
        `<h1 style="margin:0 0 16px;font-size:22px;">Refund processed</h1>`,
        `<p style="${P}">Hi ${escapeHtml(firstName)},</p>`,
        `<p style="${P}">${escapeHtml(intro)}</p>`,
        `<p style="margin:0 0 24px;padding:12px 16px;background:#f4f5f4;border-radius:6px;font-size:14px;line-height:1.6;">Amount refunded: <strong>${escapeHtml(refunded)}</strong> (${escapeHtml(currency)})<br>${escapeHtml(reference)}</p>`,
        `<p style="${P}">${escapeHtml(timing)}</p>`,
        ...(link ? [buttonHtml(link, "View Order")] : []),
        `<p style="margin:0;${SMALL}">— The ${escapeHtml(name)} team</p>`,
    ].join("\n") });

    return { subject, text, html };
}
