// Product review helpers (src/utils/reviews.js): validation that mirrors the
// API, counts, star display, dates and error messages.
// Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
    REVIEW_BODY,
    formatAverage,
    formatReviewDate,
    ratingLabel,
    reviewCountText,
    reviewErrorMessage,
    reviewFieldErrors,
    starFills,
    textLength,
    validateReview,
} from "../src/utils/reviews.js";

const body = "Great fit and the fabric feels solid.";

test("rating must be a whole number from 1 to 5", () => {
    for (const rating of [1, 3, 5]) assert.equal(validateReview({ rating, body }).valid, true, String(rating));

    for (const rating of [0, 6, -1, 4.5, "5", null, undefined, Number.NaN]) {
        const result = validateReview({ rating, body });
        assert.equal(result.valid, false, String(rating));
        assert.equal(result.errors.rating, "Choose a rating from 1 to 5 stars");
        assert.equal(result.errors.body, undefined);
    }
});

test("review text is trimmed and must be 10 to 2,000 characters", () => {
    assert.equal(validateReview({ rating: 4, body: "" }).errors.body, "Write a few words about the product");
    assert.equal(validateReview({ rating: 4, body: "     " }).errors.body, "Write a few words about the product");
    assert.equal(validateReview({ rating: 4, body: undefined }).errors.body, "Write a few words about the product");
    assert.equal(validateReview({ rating: 4, body: "  too short  " }).errors.body, "Your review must be at least 10 characters");
    assert.equal(validateReview({ rating: 4, body: "x".repeat(2001) }).errors.body, "Your review must be at most 2,000 characters");

    const exact = validateReview({ rating: 4, body: "  abcdefghij \n" });
    assert.equal(exact.valid, true);
    assert.deepEqual(exact.value, { rating: 4, body: "abcdefghij" });

    assert.equal(validateReview({ rating: 4, body: "x".repeat(REVIEW_BODY.max) }).valid, true);
});

test("length is counted in code points, as the API and MySQL count it", () => {
    const heart = "❤️"; // U+2764 U+FE0F: two code points, two UTF-16 units

    assert.equal(textLength(heart), 2);
    assert.equal(textLength("😀"), 1); // one code point, two UTF-16 units
    assert.equal(textLength(null), 0);

    assert.equal(validateReview({ rating: 5, body: heart.repeat(1000) }).valid, true);
    assert.equal(validateReview({ rating: 5, body: heart.repeat(1001) }).valid, false);
    assert.equal(validateReview({ rating: 5, body: "😀".repeat(2000) }).valid, true);
});

test("review counts and averages", () => {
    assert.equal(reviewCountText(0), "No reviews yet");
    assert.equal(reviewCountText(undefined), "No reviews yet");
    assert.equal(reviewCountText(1), "1 review");
    assert.equal(reviewCountText(12), "12 reviews");
    assert.equal(reviewCountText(1234), "1,234 reviews");

    assert.equal(formatAverage(3.6), "3.6");
    assert.equal(formatAverage(4), "4.0");
    assert.equal(formatAverage(null), "");

    assert.equal(ratingLabel(4), "4 out of 5 stars");
    assert.equal(ratingLabel(3.6), "3.6 out of 5 stars");
});

test("stars are filled to the nearest half", () => {
    assert.deepEqual(starFills(0), ["empty", "empty", "empty", "empty", "empty"]);
    assert.deepEqual(starFills(5), ["full", "full", "full", "full", "full"]);
    assert.deepEqual(starFills(3.6), ["full", "full", "full", "half", "empty"]);
    assert.deepEqual(starFills(3.2), ["full", "full", "full", "empty", "empty"]);
    assert.deepEqual(starFills(1), ["full", "empty", "empty", "empty", "empty"]);
    assert.deepEqual(starFills(null), ["empty", "empty", "empty", "empty", "empty"]);
    assert.deepEqual(starFills(9), ["full", "full", "full", "full", "full"]);
});

test("review dates", () => {
    assert.equal(formatReviewDate("2026-10-15T06:56:52.558Z", { timeZone: "UTC" }), "Oct 15, 2026");
    assert.equal(formatReviewDate("not a date"), "");
    assert.equal(formatReviewDate(null), "");
});

test("error messages for each API outcome", () => {
    assert.match(reviewErrorMessage({ status: 401 }), /sign in again/);
    assert.equal(reviewErrorMessage({ status: 403 }), "Only customer accounts can write reviews.");
    assert.match(reviewErrorMessage({ status: 404 }), /no longer available/);
    assert.match(reviewErrorMessage({ status: 409 }), /already reviewed this product/);
    assert.equal(reviewErrorMessage({ status: 422 }), "Please fix the highlighted fields.");
    assert.equal(reviewErrorMessage({ status: 429, message: "Too many review changes, please try again later" }),
        "Too many review changes, please try again later");
    assert.match(reviewErrorMessage({ status: 429 }), /Too many review changes/);
    assert.equal(reviewErrorMessage({ status: 500, message: "Internal server error" }), "Something went wrong. Please try again.");
    assert.equal(reviewErrorMessage(undefined), "Something went wrong. Please try again.");

    assert.deepEqual(reviewFieldErrors({ fields: { body: "Too short", rating: "Bad", id: "ignored" } }), { body: "Too short", rating: "Bad" });
    assert.deepEqual(reviewFieldErrors({}), {});
});
