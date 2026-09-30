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

        req.user = { id: Number(payload.sub), role: payload.role };

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
