import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/jwt.js";

// Requires "Authorization: Bearer <access token>" and sets req.user.
export function authenticate(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return next(new ApiError(401, "Authentication required"));
    }

    try {
        const payload = verifyAccessToken(token);

        // sessionId is null for tokens issued without one (see signAccessToken).
        req.user = { id: Number(payload.sub), role: payload.role, sessionId: payload.sid ?? null };

        next();
    } catch {
        next(new ApiError(401, "Invalid or expired access token"));
    }
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
