// Outgoing email. MAIL_PROVIDER picks the transport (config/env.js validates it):
//   console   default outside production. Prints each message, links included,
//             to the server log so the flows can be used locally. Refused in
//             production, where the log would hold working reset links.
//   disabled  default in production. Sends nothing; the requests that send
//             mail still succeed, so the response never reveals it.
// A real provider (SMTP, an email API) is another entry in PROVIDERS with the
// same send({ to, subject, text }) signature, plus its settings in env.js.

const PROVIDERS = {
    console: async ({ to, subject, text }) => {
        console.log(`[mail:console] To: ${to}\nSubject: ${subject}\n\n${text}\n[/mail:console]`);
    },
    disabled: async () => {},
};

export function mailProvider(env = process.env) {
    return env.MAIL_PROVIDER || (env.NODE_ENV === "production" ? "disabled" : "console");
}

export const MAIL_PROVIDERS = Object.keys(PROVIDERS);

// Never awaited by request handlers (so response time does not depend on the
// provider) and never rejects: a failure is logged without the message body,
// which holds the token.
export function sendMail(message, label) {
    return PROVIDERS[mailProvider()](message).catch((error) => {
        console.error(`Failed to send ${label} email: ${error?.message ?? "unknown error"}`);
    });
}

// Frontend URL for a link in an email (CLIENT_URL is an exact origin).
export function appLink(path, token) {
    return `${process.env.CLIENT_URL}${path}?token=${encodeURIComponent(token)}`;
}
