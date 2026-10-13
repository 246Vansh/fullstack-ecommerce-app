// formatPrice (src/utils/money.js): the one USD display format.
// Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatPrice } from "../src/utils/money.js";

test("two decimals and the dollar sign", () => {
    assert.equal(formatPrice(9.99), "$9.99");
    assert.equal(formatPrice(12.5), "$12.50");
    assert.equal(formatPrice("22.00"), "$22.00");
});

test("thousands separators for large prices", () => {
    assert.equal(formatPrice(999.99), "$999.99");
    assert.equal(formatPrice(1000), "$1,000.00");
    assert.equal(formatPrice("36999.99"), "$36,999.99");
    assert.equal(formatPrice(17172492.31), "$17,172,492.31");
});

test("missing values read as zero, matching the previous behavior", () => {
    assert.equal(formatPrice(null), "$0.00");
    assert.equal(formatPrice(undefined), "$0.00");
});

test("matches components/ui/productPrice.vue's Intl formatter", () => {
    const productPrice = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
    for (const value of [0, 0.79, 9.99, 129.99, 1000, 36999.99]) {
        assert.equal(formatPrice(value), productPrice.format(value), String(value));
    }
});
