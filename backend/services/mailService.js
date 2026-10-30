import nodemailer from "nodemailer";

// Outgoing email. MAIL_PROVIDER picks the transport (config/env.js validates it):
//   smtp      real delivery through any SMTP server (Resend, Brevo, SES, Gmail
//             app password, ...), using SMTP_HOST/PORT/USER/PASS and MAIL_FROM.
//   console   default outside production. Prints each message, links included,
//             to the server log so the flows can be used locally. Refused in
//             production, where the log would hold working reset links.
//   disabled  default in production. Sends nothing; the requests that send
//             mail still succeed, so the response never reveals it.
// Each provider has the signature send({ to, subject, text, html }) and
// rejects when the message was not accepted.

let smtpTransport;

function smtp(env = process.env) {
    smtpTransport ??= nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        // Implicit TLS on 465; elsewhere STARTTLS, required unless SMTP_SECURE
        // is explicitly "false" (a local relay without TLS).
        secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : Number(env.SMTP_PORT) === 465,
        requireTLS: !env.SMTP_SECURE && Number(env.SMTP_PORT) !== 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
    });
    return smtpTransport;
}

const PROVIDERS = {
    smtp: async ({ to, subject, text, html }) => {
        const info = await smtp().sendMail({ from: process.env.MAIL_FROM, to, subject, text, html });
        // The server can accept the connection but refuse the recipient.
        if (!info.accepted?.includes(to)) {
            throw Object.assign(new Error("recipient rejected by the SMTP server"), { response: info.response });
        }
    },
    console: async ({ to, subject, text }) => {
        console.log(`[mail:console] To: ${to}\nSubject: ${subject}\n\n${text}\n[/mail:console]`);
    },
    disabled: async () => {
        throw new Error("MAIL_PROVIDER is disabled; nothing was sent");
    },
};

export function mailProvider(env = process.env) {
    return env.MAIL_PROVIDER || (env.NODE_ENV === "production" ? "disabled" : "console");
}

export const MAIL_PROVIDERS = Object.keys(PROVIDERS);

// "harsh@example.com" -> "h***@example.com": enough to match a log line to a
// report without writing full addresses to the log.
const maskAddress = (address) => String(address).replace(/^(.).*(@.*)$/, "$1***$2");

// Resolves true when the provider accepted the message, false otherwise; never
// rejects. A failure is logged with the provider's diagnostics (error code,
// SMTP reply) but never the message body, which holds the token.
export async function sendMail(message, label) {
    try {
        await PROVIDERS[mailProvider()](message);
        return true;
    } catch (error) {
        const details = [error?.code, error?.responseCode, error?.command, error?.response]
            .filter(Boolean).join(" | ");
        console.error(`Failed to send ${label} email to ${maskAddress(message.to)} via ${mailProvider()}: ${error?.message ?? "unknown error"}${details ? ` (${details})` : ""}`);
        return false;
    }
}

// Frontend URL for a link in an email (CLIENT_URL is an exact origin).
export function appLink(path, token) {
    return `${process.env.CLIENT_URL}${path}?token=${encodeURIComponent(token)}`;
}
