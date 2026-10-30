// Email bodies. Each returns { subject, text, html }: the text part is the
// complete message for clients that do not render HTML.

const BRAND_COLOR = "#285943";

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

    // Tables and inline styles: many email clients ignore <style> and flexbox.
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f4;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f4;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:${BRAND_COLOR};padding:20px 32px;color:#ffffff;font-size:20px;font-weight:bold;">${n}</td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 16px;font-size:22px;">Verify your email address</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(firstName)},</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">Thanks for creating an account with ${n}. Please confirm that this is your email address.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background:${BRAND_COLOR};">
<a href="${href}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">Verify Email</a>
</td></tr></table>
<p style="margin:24px 0 8px;font-size:13px;line-height:1.6;color:#52606d;">Button not working? Copy and paste this link into your browser:</p>
<p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${href}" style="color:${BRAND_COLOR};">${href}</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#52606d;">This link expires in ${validFor} and can be used once.</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#52606d;">If you did not create an account, you can safely ignore this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    return { subject, text, html };
}
