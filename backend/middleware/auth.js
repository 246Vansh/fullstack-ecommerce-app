import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/jwt.js";

const invalidToken = () => new ApiError(401, "Invalid or expired access token");

// Whether the login session (refresh-token family) an access token was issued
// for is still signed in: some token of it is unrevoked and unexpired. Logout,
// "sign out everywhere", a password change or reset, reuse detection and
// account deletion all revoke or delete the family, so its access tokens stop
// working at once instead of up to 15 minutes later. One indexed query.
async function isSessionActive(userId, sessionId) {
    const row = await prisma.refreshToken.findFirst({
        where: { familyId: sessionId, userId, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true },
    });

    return Boolean(row);
}

// Requires "Authorization: Bearer <access token>" and sets req.user.
export async function authenticate(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return next(new ApiError(401, "Authentication required"));
    }

    let payload;
    try {
        payload = verifyAccessToken(token);
    } catch {
        return next(invalidToken());
    }

    const userId = Number(payload.sub);
    const sessionId = typeof payload.sid === "string" ? payload.sid : null;

    // Login always issues tokens with a session id (sid). A token without one
    // can only come from code holding the signing secret (tests); production
    // refuses it, since it cannot be tied to a session that might be revoked.
    if (!sessionId) {
        if (process.env.NODE_ENV === "production") return next(invalidToken());
    } else {
        try {
            if (!await isSessionActive(userId, sessionId)) return next(invalidToken());
        } catch (err) {
            return next(err);
        }
    }

    req.user = { id: userId, role: payload.role, sessionId };

    next();
}

// Use after authenticate: authorize("ADMIN")
export function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new ApiError(403, "You do not have permission to perform this action"));
        }

        next();
    };
}

// Use after authorize("ADMIN") on admin routes. The token's role is up to 15
// minutes old, so the role is re-read from the database: a demoted or deleted
// admin loses access immediately, not when their access token expires.
export async function requireCurrentAdmin(req, res, next) {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });

    if (user?.role !== "ADMIN") {
        return next(new ApiError(403, "You do not have permission to perform this action"));
    }

    next();
}
