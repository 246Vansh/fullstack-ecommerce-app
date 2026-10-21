// Guest cart currency rules (src/utils/cartCurrency.js).
// Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { addsSecondCurrency, cartCurrencyOf } from "../src/utils/cartCurrency.js";

const byStored = (item) => item.currency;

test("a cart in one currency has that currency", () => {
    assert.deepEqual(cartCurrencyOf(["INR", "INR"]), { currency: "INR", mixedCurrency: false });
    assert.deepEqual(cartCurrencyOf(["USD"]), { currency: "USD", mixedCurrency: false });
});

test("an empty cart has no currency", () => {
    assert.deepEqual(cartCurrencyOf([]), { currency: null, mixedCurrency: false });
});

test("a cart mixing currencies has no currency and is flagged", () => {
    assert.deepEqual(cartCurrencyOf(["USD", "INR"]), { currency: null, mixedCurrency: true });
});

test("items with an unknown currency (removed products) do not count", () => {
    assert.deepEqual(cartCurrencyOf([null, "INR"]), { currency: "INR", mixedCurrency: false });
});

test("adding a product in another currency is refused", () => {
    const stored = [{ variantId: 1, productId: 10, quantity: 1, currency: "USD" }];

    assert.equal(addsSecondCurrency(stored, { variantId: 2, currency: "INR" }, byStored), true);
});

test("adding a product in the cart's currency is allowed", () => {
    const stored = [{ variantId: 1, productId: 10, quantity: 1, currency: "INR" }];

    assert.equal(addsSecondCurrency(stored, { variantId: 2, currency: "INR" }, byStored), false);
    assert.equal(addsSecondCurrency([], { variantId: 2, currency: "INR" }, byStored), false);
});

test("adding more of the same variant is never a currency conflict", () => {
    const stored = [{ variantId: 1, productId: 10, quantity: 1, currency: "USD" }];

    assert.equal(addsSecondCurrency(stored, { variantId: 1, currency: "USD" }, byStored), false);
});

test("legacy guest items stored before currencies use catalog data, and unknown ones are left to the server", () => {
    const legacy = [{ variantId: 1, productId: 10, quantity: 1 }];

    assert.equal(addsSecondCurrency(legacy, { variantId: 2, currency: "INR" }, () => "USD"), true);
    assert.equal(addsSecondCurrency(legacy, { variantId: 2, currency: "INR" }, () => undefined), false);
});

test("an add without a known currency is not blocked here", () => {
    const stored = [{ variantId: 1, productId: 10, quantity: 1, currency: "USD" }];

    assert.equal(addsSecondCurrency(stored, { variantId: 2, currency: undefined }, byStored), false);
});
