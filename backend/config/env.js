// Validates the backend environment at startup. Importing this module checks
// process.env and exits with a readable list of problems; values are never
// printed, only variable names.

import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";

import { MAIL_PROVIDERS } from "../services/mailService.js";
import { createdCutoffMs, DEFAULT_CREATED_CUTOFF } from "./reservations.js";
import { tokenLifetimeSeconds, DEFAULT_REFRESH_EXPIRES_IN, DEFAULT_SESSION_ABSOLUTE_EXPIRES_IN } from "../utils/jwt.js";

const NODE_ENVS = ["development", "production", "test"];
const SAME_SITE = ["lax", "strict", "none"];
const MIN_SECRET_LENGTH = 32;

// The Razorpay dashboard lets any string be the webhook secret; refuse short ones.
const MIN_WEBHOOK_SECRET_LENGTH = 16;

function isUrl(value, protocols) {
    try {
        return protocols.includes(new URL(value).protocol);
    } catch {
        return false;
    }
}

// CORS compares CLIENT_URL with the browser's Origin header character for
// character, so it must be written exactly as an origin: scheme, lowercase
// host and non-default port only. "https://shop.example.com/" (trailing slash),
// a path, a query or credentials would make browsers reject every response.
function isExactOrigin(value) {
    try {
        return new URL(value).origin === value;
    } catch {
        return false;
    }
}

// A duration with a unit ("15m", "12h", "7d") that jsonwebtoken accepts and
// that lasts at least a second. A bare number is refused: jsonwebtoken reads
// "900" as 900 milliseconds, so the token would expire at once.
function isTokenLifetime(value) {
    return !/^\s*-?[\d.]+\s*$/.test(value) && tokenLifetimeSeconds(value) >= 1;
}

// TRUST_PROXY: unset/"false" = off (default), a hop count ("1"), or an
// Express trust list such as "loopback" or "10.0.0.0/8". "true" trusts every
// proxy, which lets clients spoof their IP, so it is rejected.
export function parseTrustProxy(value) {
    const raw = String(value ?? "").trim();

    if (raw === "" || raw === "false") return false;
    if (raw === "true") return undefined;
    if (/^\d+$/.test(raw)) return Number(raw);

    return raw;
}

// Compiles the value the way server.js applies it, so a malformed address
// list is reported here instead of throwing from app.set() at startup.
function isValidTrustProxy(value) {
    try {
        express().set("trust proxy", value);
        return true;
    } catch {
        return false;
    }
}

// DATABASE_SSL_CA must name a readable file that starts with a PEM
// certificate. Neither the path's contents nor the parse error is reported.
function isPemCertificateFile(path) {
    try {
        new X509Certificate(readFileSync(path));
        return true;
    } catch {
        return false;
    }
}

export function validateEnv(env = process.env) {
    const errors = [];
    const required = (name) => {
        if (!env[name] || !String(env[name]).trim()) {
            errors.push(`${name} is required`);
            return false;
        }
        return true;
    };

    if (required("NODE_ENV") && !NODE_ENVS.includes(env.NODE_ENV)) {
        errors.push(`NODE_ENV must be one of: ${NODE_ENVS.join(", ")}`);
    }

    if (required("DATABASE_URL") && !isUrl(env.DATABASE_URL, ["mysql:", "mariadb:"])) {
        errors.push("DATABASE_URL must be a mysql:// or mariadb:// URL");
    }

    for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
        if (required(name) && env[name].length < MIN_SECRET_LENGTH) {
            errors.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters`);
        }
    }

    if (env.JWT_ACCESS_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
        errors.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
    }

    if (required("CLIENT_URL")) {
        if (!isUrl(env.CLIENT_URL, ["http:", "https:"])) {
            errors.push("CLIENT_URL must be an http:// or https:// URL");
        } else if (!isExactOrigin(env.CLIENT_URL)) {
            errors.push("CLIENT_URL must be the frontend origin only, e.g. https://shop.example.com (lowercase host; no path, trailing slash, query or default port)");
        }
    }

    for (const name of ["JWT_ACCESS_EXPIRES_IN", "JWT_REFRESH_EXPIRES_IN", "SESSION_ABSOLUTE_EXPIRES_IN"]) {
        // Blank means the default (utils/jwt.js).
        if (String(env[name] ?? "").trim() && !isTokenLifetime(env[name])) {
            errors.push(`${name} must be a duration with a unit, such as "15m", "12h" or "7d"`);
        }
    }

    // A session shorter than one refresh token would cut every token short;
    // almost certainly a mistake. Checked only when both values are valid.
    const refreshLifetime = env.JWT_REFRESH_EXPIRES_IN || DEFAULT_REFRESH_EXPIRES_IN;
    const sessionLifetime = env.SESSION_ABSOLUTE_EXPIRES_IN || DEFAULT_SESSION_ABSOLUTE_EXPIRES_IN;
    if (isTokenLifetime(refreshLifetime) && isTokenLifetime(sessionLifetime)
        && tokenLifetimeSeconds(sessionLifetime) < tokenLifetimeSeconds(refreshLifetime)) {
        errors.push("SESSION_ABSOLUTE_EXPIRES_IN must be at least JWT_REFRESH_EXPIRES_IN");
    }

    // Blank means the default port (server.js).
    if (String(env.PORT ?? "").trim() && !(/^\d+$/.test(env.PORT) && Number(env.PORT) >= 1 && Number(env.PORT) <= 65535)) {
        errors.push("PORT must be a whole number from 1 to 65535");
    }

    if (env.DATABASE_SSL && !["true", "false"].includes(env.DATABASE_SSL)) {
        errors.push('DATABASE_SSL must be "true" or "false"');
    }

    if (env.DATABASE_SSL_CA) {
        if (env.DATABASE_SSL !== "true") {
            errors.push("DATABASE_SSL_CA is set but DATABASE_SSL is not true, so TLS would be off");
        } else if (!isPemCertificateFile(env.DATABASE_SSL_CA)) {
            errors.push("DATABASE_SSL_CA must be the path to a readable PEM certificate file");
        }
    }

    if (env.TRUST_PROXY !== undefined) {
        const trustProxy = parseTrustProxy(env.TRUST_PROXY);

        if (trustProxy === undefined || !isValidTrustProxy(trustProxy)) {
            errors.push('TRUST_PROXY must be "false", a hop count such as "1", or a trusted address list (not "true")');
        }
    }

    // Online payment is optional: both Razorpay keys, or neither (then only
    // cash on delivery is offered). The secret is never sent to the browser.
    const razorpayKeyId = String(env.RAZORPAY_KEY_ID ?? "").trim();
    const razorpaySecret = String(env.RAZORPAY_KEY_SECRET ?? "").trim();

    if (Boolean(razorpayKeyId) !== Boolean(razorpaySecret)) {
        errors.push("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set together (or both left empty to disable online payment)");
    } else if (razorpayKeyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(razorpayKeyId)) {
        errors.push("RAZORPAY_KEY_ID must be a Razorpay key id (rzp_test_... or rzp_live_...)");
    }

    // The secret entered on the webhook in the Razorpay dashboard. It is a
    // separate secret: the API key secret must never be reused for it.
    const webhookSecret = String(env.RAZORPAY_WEBHOOK_SECRET ?? "").trim();

    if (webhookSecret && webhookSecret === razorpaySecret) {
        errors.push("RAZORPAY_WEBHOOK_SECRET must be different from RAZORPAY_KEY_SECRET");
    } else if (webhookSecret && webhookSecret.length < MIN_WEBHOOK_SECRET_LENGTH) {
        errors.push(`RAZORPAY_WEBHOOK_SECRET must be at least ${MIN_WEBHOOK_SECRET_LENGTH} characters`);
    }

    if (env.RESERVATION_EXPIRY_WORKER && !["true", "false"].includes(env.RESERVATION_EXPIRY_WORKER)) {
        errors.push('RESERVATION_EXPIRY_WORKER must be "true" or "false" (unset = true)');
    }

    if (String(env.RESERVATION_CREATED_CUTOFF ?? "").trim() && createdCutoffMs(env.RESERVATION_CREATED_CUTOFF) === null) {
        errors.push(`RESERVATION_CREATED_CUTOFF must be a duration with a unit from 1m to 24h, e.g. 90m or 2h (unset = ${DEFAULT_CREATED_CUTOFF})`);
    }

    if (env.COOKIE_SAME_SITE && !SAME_SITE.includes(env.COOKIE_SAME_SITE)) {
        errors.push(`COOKIE_SAME_SITE must be one of: ${SAME_SITE.join(", ")}`);
    }

    if (env.COOKIE_SECURE && !["true", "false"].includes(env.COOKIE_SECURE)) {
        errors.push('COOKIE_SECURE must be "true" or "false"');
    }

    // Blank means the default (services/mailService.js).
    if (String(env.MAIL_PROVIDER ?? "").trim() && !MAIL_PROVIDERS.includes(env.MAIL_PROVIDER)) {
        errors.push(`MAIL_PROVIDER must be one of: ${MAIL_PROVIDERS.join(", ")}`);
    }

    if (env.NODE_ENV === "production") {
        // The console provider writes working reset links to the log.
        if (env.MAIL_PROVIDER === "console") {
            errors.push("MAIL_PROVIDER cannot be console in production");
        }
        if (env.COOKIE_SECURE === "false") {
            errors.push("COOKIE_SECURE cannot be false in production");
        }
        if (env.CLIENT_URL && isUrl(env.CLIENT_URL, ["http:"])) {
            errors.push("CLIENT_URL must use https in production");
        }
        // Unset would silently mean "no proxy": behind one, every client then
        // shares the proxy's IP and rate-limit budget. Make the choice explicit.
        if (!String(env.TRUST_PROXY ?? "").trim()) {
            errors.push('TRUST_PROXY is required in production: "false" when clients connect directly, otherwise the proxies in front of the app');
        }
        // Without the webhook, a payment whose browser tab was closed is only
        // noticed when someone refreshes it (or the expiry worker asks).
        if (razorpayKeyId && razorpaySecret && !webhookSecret) {
            errors.push("RAZORPAY_WEBHOOK_SECRET is required in production when online payment is enabled");
        }
        // Plaintext to the database must be a deliberate choice, not a default.
        if (!env.DATABASE_SSL) {
            errors.push('DATABASE_SSL is required in production: "true" (verified TLS) or "false" (database reached only over a trusted private network)');
        }
    }

    return errors;
}

const errors = validateEnv();

if (errors.length) {
    console.error(`Invalid configuration:\n${errors.map((error) => `  - ${error}`).join("\n")}`);
    process.exit(1);
}
