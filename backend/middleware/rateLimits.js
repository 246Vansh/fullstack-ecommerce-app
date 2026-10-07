import rateLimit from "express-rate-limit";

// Separate budgets per purpose, so exhausting one (e.g. failed logins) never
// blocks another (catalog browsing). Counters are in memory, per process.

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const limiter = (options) => rateLimit({
    windowMs: FIFTEEN_MINUTES,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later" },
    ...options,
});

// Every /api request except /api/auth, which has its own budgets below.
// Sized for normal browsing (catalog, search, filters, cart) by one visitor.
export const generalLimiter = limiter({
    limit: 1000,
    skip: (req) => req.path.startsWith("/auth/"),
});

// Login and register: slows credential stuffing and account spam.
export const credentialsLimiter = limiter({
    limit: 20,
    message: { success: false, message: "Too many attempts, please try again later" },
});

// Refresh and logout run on every page load; generous, but bounded.
export const sessionLimiter = limiter({
    limit: 120,
});

// Order placement, keyed by user (use after authenticate), so a shared IP
// does not share the budget and one account cannot flood order creation.
export const orderMutationLimiter = limiter({
    limit: 10,
    keyGenerator: (req) => `user:${req.user.id}`,
    message: { success: false, message: "Too many order attempts, please try again later" },
});
