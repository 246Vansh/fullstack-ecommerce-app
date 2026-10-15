// Product review helpers shared by the reviews UI and its tests. No "@/"
// imports, so node --test can load this file directly.

// Same rules as the API (backend/routes/reviewRoutes.js).
export const REVIEW_RATING = { min: 1, max: 5 };
export const REVIEW_BODY = { min: 10, max: 2000 };

// Reviews per page; the API allows up to 50.
export const REVIEW_PAGE_SIZE = 10;

// Characters as the API and MySQL count them (code points), so an emoji
// counts once and the limit shown matches the limit enforced.
export const textLength = (value) => Array.from(value ?? "").length;

const count = new Intl.NumberFormat("en-US");

// Client-side check before sending; the server repeats it. `value` is what
// would be sent: the rating, and the body trimmed as the server stores it.
export function validateReview({ rating, body }) {
    const errors = {};
    const text = typeof body === "string" ? body.trim() : "";
    const length = textLength(text);

    if (!Number.isInteger(rating) || rating < REVIEW_RATING.min || rating > REVIEW_RATING.max) {
        errors.rating = "Choose a rating from 1 to 5 stars";
    }

    if (length === 0) {
        errors.body = "Write a few words about the product";
    } else if (length < REVIEW_BODY.min) {
        errors.body = `Your review must be at least ${REVIEW_BODY.min} characters`;
    } else if (length > REVIEW_BODY.max) {
        errors.body = `Your review must be at most ${count.format(REVIEW_BODY.max)} characters`;
    }

    return { valid: Object.keys(errors).length === 0, errors, value: { rating, body: text } };
}

export function reviewCountText(total) {
    if (!total) return "No reviews yet";

    return `${count.format(total)} ${total === 1 ? "review" : "reviews"}`;
}

// "4.5"; empty when there is no average (no reviews).
export const formatAverage = (average) => (average == null ? "" : Number(average).toFixed(1));

export function ratingLabel(rating) {
    const value = Number(rating);
    const shown = Number.isInteger(value) ? String(value) : value.toFixed(1);

    return `${shown} out of 5 stars`;
}

// Five star states for a rating, to the nearest half: "full", "half" or "empty".
export function starFills(rating) {
    const halves = Math.round(Math.min(Math.max(Number(rating) || 0, 0), 5) * 2);

    return Array.from({ length: 5 }, (_, index) => {
        const left = halves - index * 2;

        return left >= 2 ? "full" : left === 1 ? "half" : "empty";
    });
}

// "Oct 15, 2026"; empty for a missing or invalid date.
export function formatReviewDate(value, { locale = "en-US", timeZone } = {}) {
    const date = new Date(value);

    if (!value || Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...(timeZone && { timeZone }) }).format(date);
}

// What to tell the customer when a review request fails. `error` is
// parseApiError output: { status, message, fields }.
export function reviewErrorMessage(error) {
    switch (error?.status) {
        case 401:
            return "Your session has expired. Please sign in again to manage your review.";
        case 403:
            return "Only customer accounts can write reviews.";
        case 404:
            return "This review or product is no longer available. The reviews have been refreshed.";
        case 409:
            return "You have already reviewed this product. You can edit your review below.";
        case 422:
            return "Please fix the highlighted fields.";
        case 429:
            return error.message || "Too many review changes. Please try again later.";
        default:
            return "Something went wrong. Please try again.";
    }
}

// Server field errors for the form (only the fields it has).
export function reviewFieldErrors(error) {
    const fields = error?.fields ?? {};

    return {
        ...(fields.rating && { rating: fields.rating }),
        ...(fields.body && { body: fields.body }),
    };
}
