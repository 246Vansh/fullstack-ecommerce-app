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

    res.status(statusCode).json({
        success: false,
        message: isServerError && process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message,
        ...(err.details && { details: err.details }),
    });
}
