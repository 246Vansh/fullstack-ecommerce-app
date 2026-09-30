import { validationResult } from "express-validator";

import { ApiError } from "../utils/ApiError.js";

// Runs after express-validator chains and returns 422 with per-field messages.
export function validate(req, res, next) {
    const result = validationResult(req);

    if (result.isEmpty()) {
        return next();
    }

    const details = result.array({ onlyFirstError: true }).map((error) => ({
        field: error.path,
        message: error.msg,
    }));

    next(new ApiError(422, "Validation failed", details));
}
