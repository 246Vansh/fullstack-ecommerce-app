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

// Every /api request except /api/auth and /api/webhooks, which have their own
// budgets below. Sized for normal browsing (catalog, search, filters, cart) by one visitor.
export const generalLimiter = limiter({
    limit: 1000,
    skip: (req) => req.path.startsWith("/auth/") || req.path.startsWith("/webhooks/"),
});

// Razorpay webhook deliveries, per IP (Razorpay sends from a few addresses).
// Generous: a 429 only delays an event, which Razorpay retries.
export const webhookLimiter = limiter({
    limit: 3000,
});

// Login and register: slows credential stuffing and account spam.
export const credentialsLimiter = limiter({
    limit: 20,
    message: { success: false, message: "Too many attempts, please try again later" },
});

// Failed logins per account, whatever IP they come from, so password
// guessing against one account from many addresses is slowed too. Use after
// the route's email rules (authRoutes loginRules): the key is the email as
// they normalized it, so aliases of one account (e.g. gmail +tags, any letter
// case) share one budget. The trim/lower-case here is only a fallback.
// Successful logins are not counted, so the owner who knows the password is
// never locked out by their own sign-ins; a lock caused by someone else's
// guessing lasts at most the window. A malformed email (normalized to false)
// shares one key; the per-IP credentialsLimiter still applies to it.
export const loginAccountLimiter = limiter({
    limit: 10,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `login:${String(req.body?.email ?? "").trim().toLowerCase().slice(0, 254)}`,
    message: { success: false, message: "Too many failed sign-in attempts for this account, please try again later" },
});

// Refresh and logout run on every page load; generous, but bounded.
export const sessionLimiter = limiter({
    limit: 120,
});

// Order placement and cancellation (both move stock), keyed by user (use after
// authenticate), so a shared IP does not share the budget and one account
// cannot churn inventory with place/cancel loops.
export const orderMutationLimiter = limiter({
    limit: 10,
    keyGenerator: (req) => `user:${req.user.id}`,
    message: { success: false, message: "Too many order attempts, please try again later" },
});

// Payment start/verify/refresh, keyed by user (use after authenticate). Each
// call may reach Razorpay; enough for a few attempts and status checks.
export const paymentLimiter = limiter({
    limit: 30,
    keyGenerator: (req) => `user:${req.user.id}`,
    message: { success: false, message: "Too many payment attempts, please try again later" },
});

// Marking notifications read, keyed by user (use after authenticate). Each
// click on a notification is one request; reads use generalLimiter.
export const notificationMutationLimiter = limiter({
    limit: 120,
    keyGenerator: (req) => `user:${req.user.id}`,
});

// Wishlist adds and removes, keyed by user (use after authenticate). One
// request per heart toggle; reads use generalLimiter.
export const wishlistMutationLimiter = limiter({
    limit: 300,
    keyGenerator: (req) => `user:${req.user.id}`,
});

// Profile edits, keyed by user (use after authenticate).
export const profileUpdateLimiter = limiter({
    limit: 20,
    keyGenerator: (req) => `user:${req.user.id}`,
    message: { success: false, message: "Too many profile changes, please try again later" },
});

// Password changes, keyed by user (use after authenticate). Each attempt
// checks the current password, so this also bounds guessing with a stolen
// access token. Counts every attempt, successful or not.
export const passwordChangeLimiter = limiter({
    limit: 5,
    keyGenerator: (req) => `user:${req.user.id}`,
    message: { success: false, message: "Too many password change attempts, please try again later" },
});

// Review create/edit/delete, keyed by user (use after authenticate). A
// customer has one review per product, so normal use is a handful of writes.
export const reviewMutationLimiter = limiter({
    limit: 20,
    keyGenerator: (req) => `user:${req.user.id}`,
    message: { success: false, message: "Too many review changes, please try again later" },
});

// "Forgot password" requests, per IP. Each one may send an email; the
// service also sends at most one link per account per minute.
// Trying coupon codes, per user: POST /coupons/validate and checkout loads
// that carry a couponCode share it, so codes cannot be guessed by trying many
// in a row. Applying one code costs two (validate, then the checkout reload),
// and each address change with a coupon applied costs one more.
export const couponAttemptLimiter = limiter({
    limit: 60,
    keyGenerator: (req) => `user:${req.user.id}`,
    message: { success: false, message: "Too many coupon attempts, please try again later" },
});

export const passwordResetRequestLimiter = limiter({
    limit: 5,
    message: { success: false, message: "Too many password reset requests, please try again later" },
});

// Submitting an emailed token (reset password, verify email), per IP, so
// tokens cannot be guessed at speed (they are 256-bit random regardless).
export const emailTokenLimiter = limiter({
    limit: 20,
    message: { success: false, message: "Too many attempts, please try again later" },
});

// Resending the verification email, keyed by user (use after authenticate).
export const verificationResendLimiter = limiter({
    limit: 3,
    keyGenerator: (req) => `user:${req.user.id}`,
    message: { success: false, message: "Too many verification emails requested, please try again later" },
});

// Listing and signing out sessions, keyed by user (use after authenticate).
export const sessionManagementLimiter = limiter({
    limit: 60,
    keyGenerator: (req) => `user:${req.user.id}`,
});

// Admin role changes, keyed by the acting admin (use after authenticate).
// Each attempt checks that admin's password, like passwordChangeLimiter, so a
// stolen admin access token cannot be used to guess it. Counts every attempt.
export const adminRoleChangeLimiter = limiter({
    limit: 5,
    keyGenerator: (req) => `user:${req.user.id}`,
    message: { success: false, message: "Too many role change attempts, please try again later" },
});

// Account deletion, keyed by user (use after authenticate). Each attempt
// checks the password, like passwordChangeLimiter.
export const accountDeletionLimiter = limiter({
    limit: 5,
    keyGenerator: (req) => `user:${req.user.id}`,
    message: { success: false, message: "Too many attempts, please try again later" },
});
