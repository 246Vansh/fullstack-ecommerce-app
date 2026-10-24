import { ApiError } from "../utils/ApiError.js";

// CSRF defence for routes that act on the refresh cookie (or create it). The
// cookie is SameSite, but with COOKIE_SAME_SITE=none, or a form POST (which
// needs no CORS preflight), a browser on another site could still send it.
// Browsers always send Origin on such requests, so one that is present and not
// CLIENT_URL is refused. Requests without Origin (same-origin GETs, non-browser
// clients) carry no ambient-cookie risk from another site and pass.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireTrustedOrigin(req, res, next) {
    const { origin } = req.headers;

    if (SAFE_METHODS.has(req.method) || origin === undefined || origin === process.env.CLIENT_URL) {
        return next();
    }

    next(new ApiError(403, "Request origin not allowed"));
}
