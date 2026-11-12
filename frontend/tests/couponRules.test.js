// Coupon helpers (src/utils/couponRules.js): admin form checks and request
// body, terms wording and datetime-local conversion.
// Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
    couponErrors, couponFormFrom, couponPayload, couponTerms, emptyCouponForm, fromLocalInput, normalizeCouponCode,
    toLocalInput, usageText,
} from "../src/utils/couponRules.js";

const valid = () => ({ ...emptyCouponForm(), code: "welcome10", discountValue: "10" });
const errorsOf = (changes) => Object.fromEntries(Object.entries(couponErrors({ ...valid(), ...changes })).filter(([, v]) => v));

test("codes are trimmed and upper-cased", () => {
    assert.equal(normalizeCouponCode("  save-200 "), "SAVE-200");
    assert.equal(normalizeCouponCode(null), "");
});

test("a valid form has no errors", () => {
    assert.deepEqual(errorsOf({}), {});
    assert.deepEqual(errorsOf({ discountType: "FIXED", discountValue: "200", minimumOrderAmount: "999.50", usageLimit: "100", usageLimitPerUser: "1" }), {});
});

test("bad codes, amounts and limits are flagged with the API's field names", () => {
    assert.ok(errorsOf({ code: "ab" }).code);
    assert.ok(errorsOf({ code: "has space" }).code);
    assert.ok(errorsOf({ discountValue: "" }).discountValue);
    assert.ok(errorsOf({ discountValue: "-5" }).discountValue);
    assert.ok(errorsOf({ discountValue: "0" }).discountValue);
    assert.ok(errorsOf({ discountValue: "1.234" }).discountValue);
    assert.match(errorsOf({ discountValue: "150" }).discountValue, /more than 100/);
    assert.deepEqual(errorsOf({ discountType: "FIXED", discountValue: "150" }), {}, "a fixed amount may exceed 100");
    assert.ok(errorsOf({ minimumOrderAmount: "-1" }).minimumOrderAmount);
    assert.deepEqual(errorsOf({ minimumOrderAmount: "0" }), {}, "zero minimum is fine");
    assert.ok(errorsOf({ usageLimit: "0" }).usageLimit);
    assert.ok(errorsOf({ usageLimit: "1.5" }).usageLimit);
    assert.match(errorsOf({ usageLimit: "2", usageLimitPerUser: "3" }).usageLimitPerUser, /total uses/);
});

test("the maximum discount is checked only for percentages", () => {
    assert.ok(errorsOf({ maximumDiscountAmount: "abc" }).maximumDiscountAmount);
    assert.deepEqual(errorsOf({ discountType: "FIXED", maximumDiscountAmount: "abc" }), {});
});

test("expiry must be after the start", () => {
    assert.ok(errorsOf({ startsAt: "2030-01-02T00:00", expiresAt: "2030-01-01T00:00" }).expiresAt);
    assert.deepEqual(errorsOf({ startsAt: "2030-01-01T00:00", expiresAt: "2030-01-02T00:00" }), {});
});

test("payload: normalised code, nulls for empty optional fields, no cap on fixed coupons", () => {
    const payload = couponPayload({ ...valid(), description: "  ", maximumDiscountAmount: "50" });
    assert.equal(payload.code, "WELCOME10");
    assert.equal(payload.description, null);
    assert.equal(payload.minimumOrderAmount, "0");
    assert.equal(payload.maximumDiscountAmount, "50");
    assert.equal(payload.usageLimit, null);
    assert.equal(payload.expiresAt, null);
    assert.equal("startsAt" in payload, false, "an empty start is not sent");

    const fixed = couponPayload({ ...valid(), discountType: "FIXED", maximumDiscountAmount: "50", usageLimit: "10" });
    assert.equal(fixed.maximumDiscountAmount, null);
    assert.equal(fixed.usageLimit, 10);
});

test("a saved coupon round-trips through the form unchanged", () => {
    const coupon = {
        id: 1, code: "FESTIVE15", description: null, discountType: "PERCENTAGE", discountValue: 15, currency: "INR",
        minimumOrderAmount: 0, maximumDiscountAmount: 500, usageLimit: null, usageLimitPerUser: 2,
        startsAt: "2026-11-01T04:30:00.000Z", expiresAt: null, isActive: true,
    };
    const form = couponFormFrom(coupon);
    assert.equal(form.minimumOrderAmount, "");
    assert.equal(form.usageLimitPerUser, "2");
    assert.deepEqual(couponPayload(form), couponPayload(couponFormFrom(coupon)));
    assert.equal(couponPayload(form).startsAt, "2026-11-01T04:30:00.000Z");
});

test("datetime-local values convert to and from ISO instants", () => {
    assert.equal(toLocalInput(null), "");
    assert.equal(fromLocalInput(""), null);
    const iso = "2026-11-12T08:45:00.000Z";
    assert.equal(fromLocalInput(toLocalInput(iso)), iso);
});

test("terms and usage read naturally", () => {
    assert.equal(couponTerms({ discountType: "PERCENTAGE", discountValue: 10, currency: "INR", maximumDiscountAmount: null }), "10% off");
    assert.match(couponTerms({ discountType: "PERCENTAGE", discountValue: 15, currency: "INR", maximumDiscountAmount: 500 }), /^15% off \(up to ₹500\.00\)$/);
    assert.equal(couponTerms({ discountType: "FIXED", discountValue: 200, currency: "INR" }), "₹200.00 off");
    assert.equal(usageText({ usedCount: 3, usageLimit: null }), "3 used");
    assert.equal(usageText({ usedCount: 3, usageLimit: 100 }), "3 / 100 used");
});
