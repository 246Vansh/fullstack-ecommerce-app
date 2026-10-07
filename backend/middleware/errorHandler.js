import { ApiError } from "../utils/ApiError.js";

export function notFound(req, res, next) {
    next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Express 5 forwards rejected async handlers here automatically.
export function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || err.status || 500;
    const isServerError = statusCode >= 500;

    if (isServerError) {
        console.error(err);
    }

    // Unexpected 5xx errors (database/Prisma, bugs) never send their raw
    // message; outside production an ApiError's own message is still shown.
    const exposeMessage = !isServerError
        || (err instanceof ApiError && process.env.NODE_ENV !== "production");

    res.status(statusCode).json({
        success: false,
        message: exposeMessage ? err.message : "Internal server error",
        ...(exposeMessage && err.details && { details: err.details }),
    });
}
