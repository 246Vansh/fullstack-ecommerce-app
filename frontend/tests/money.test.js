// formatPrice (src/utils/money.js): amounts in their own stored currency.
// Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatPrice, UNKNOWN_PRICE } from "../src/utils/money.js";

test("USD: two decimals and the dollar sign (unchanged for existing prices and orders)", () => {
    assert.equal(formatPrice(9.99, "USD"), "$9.99");
    assert.equal(formatPrice(12.5, "USD"), "$12.50");
    assert.equal(formatPrice("22.00", "USD"), "$22.00");
});

test("USD: thousands separators for large prices", () => {
    assert.equal(formatPrice(999.99, "USD"), "$999.99");
    assert.equal(formatPrice(1000, "USD"), "$1,000.00");
    assert.equal(formatPrice("36999.99", "USD"), "$36,999.99");
    assert.equal(formatPrice(17172492.31, "USD"), "$17,172,492.31");
});

test("INR: the rupee sign and Indian digit grouping", () => {
    assert.equal(formatPrice(499, "INR"), "₹499.00");
    assert.equal(formatPrice("1999.50", "INR"), "₹1,999.50");
    assert.equal(formatPrice(100000, "INR"), "₹1,00,000.00");
    assert.equal(formatPrice("12345678.90", "INR"), "₹1,23,45,678.90");
});

test("the same number is never shown in another currency's format", () => {
    assert.notEqual(formatPrice(499, "USD"), formatPrice(499, "INR"));
    assert.equal(formatPrice(499, "USD"), "$499.00");
});

test("missing values read as zero in the given currency", () => {
    assert.equal(formatPrice(null, "USD"), "$0.00");
    assert.equal(formatPrice(undefined, "INR"), "₹0.00");
});

test("a missing or unknown currency is never guessed", () => {
    for (const currency of [undefined, null, "", "usd", "EUR"]) {
        assert.equal(formatPrice(10, currency), UNKNOWN_PRICE, String(currency));
    }
});
