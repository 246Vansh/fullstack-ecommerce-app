import { body, query, validationResult } from "express-validator";

import { ApiError } from "../utils/ApiError.js";

// A password being set (registration, password change). bcrypt only uses the
// first 72 bytes, so the limit is on the UTF-8 byte length, not characters:
// an accented letter is 2 bytes, most emoji 4. Longer passwords would be
// silently truncated.
export const MAX_PASSWORD_BYTES = 72;

export const newPasswordRule = (field) => body(field)
    .isString().withMessage("Password is required").bail()
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters").bail()
    .custom((value) => Buffer.byteLength(value, "utf8") <= MAX_PASSWORD_BYTES)
    .withMessage("Password is too long (at most 72 bytes; accented letters and emoji count as more than one)");

// Upper bound for a password being checked (login, current password), so a
// huge string never reaches bcrypt. Far above anything ever accepted when
// setting one (72 characters before the byte rule), so no stored password is
// locked out.
export const MAX_PASSWORD_INPUT_LENGTH = 1024;

// A query value that must be given once. A repeated parameter (?page=1&page=2)
// arrives as an array, which validators would check item by item and then pass
// on as an array; reject it rather than guess which value was meant.
export const singleQuery = (name) => query(name)
    .not().isArray().withMessage(`${name} must be given once`)
    .bail();

// page and limit for list endpoints. page is capped so the row offset
// (page - 1) * limit is always a safe integer; anything larger used to reach
// the database as an imprecise number and fail with a 500.
export function paginationRules({ defaultLimit, maxLimit }) {
    const maxPage = Math.floor(Number.MAX_SAFE_INTEGER / maxLimit);

    return [
        singleQuery("page").default(1)
            .isInt({ min: 1, max: maxPage }).withMessage(`page must be between 1 and ${maxPage}`).toInt(),
        singleQuery("limit").default(defaultLimit)
            .isInt({ min: 1, max: maxLimit }).withMessage(`limit must be between 1 and ${maxLimit}`).toInt(),
    ];
}

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
