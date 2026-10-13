// Order receipt rows (src/utils/receipt.js), built from the saved order snapshot.
// Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { receiptAddressLines, receiptLines, receiptTotals } from "../src/utils/receipt.js";

const order = {
    subtotal: "50.00",
    shipping: "0.00",
    discount: "0.00",
    tax: "0.00",
    total: "50.00",
    items: [
        { id: 1, productName: "Linen Shirt", sku: "LS-M-BLU", color: "Blue", size: "M", quantity: 2, unitPrice: "20.00", lineTotal: "40.00" },
        { id: 2, productName: "Socks", sku: "SK-1", color: null, size: null, quantity: 1, unitPrice: "10.00", lineTotal: "10.00" },
    ],
};

test("line items use the saved name, unit price and line total", () => {
    assert.deepEqual(receiptLines(order), [
        { id: 1, name: "Linen Shirt", sku: "LS-M-BLU", options: "Blue / M", quantity: 2, unitPrice: "$20.00", lineTotal: "$40.00" },
        { id: 2, name: "Socks", sku: "SK-1", options: "", quantity: 1, unitPrice: "$10.00", lineTotal: "$10.00" },
    ]);
});

test("saved amounts are shown as stored, never recomputed from items", () => {
    // A historical line whose stored total differs from unitPrice x quantity
    // (e.g. priced before a catalog change) must keep its stored amounts.
    const historical = {
        ...order,
        subtotal: "33.00",
        items: [{ ...order.items[0], unitPrice: "99.00", lineTotal: "33.00" }],
    };

    assert.equal(receiptLines(historical)[0].lineTotal, "$33.00");
    assert.equal(receiptLines(historical)[0].unitPrice, "$99.00");
    assert.equal(receiptTotals(historical)[0].value, "$33.00");
});

test("zero discount and tax are omitted; zero shipping reads Free", () => {
    assert.deepEqual(receiptTotals(order), [
        { label: "Subtotal", value: "$50.00" },
        { label: "Shipping", value: "Free" },
    ]);
});

test("stored shipping, discount and tax are shown when present", () => {
    const rows = receiptTotals({ ...order, shipping: "5.00", discount: "4.50", tax: "2.25" });

    assert.deepEqual(rows.map((row) => row.label), ["Subtotal", "Shipping", "Discount", "Tax"]);
    assert.deepEqual(rows.map((row) => row.value), ["$50.00", "$5.00", "-$4.50", "$2.25"]);
});

test("address lines skip missing optional fields", () => {
    assert.deepEqual(receiptAddressLines({
        firstName: "Ana", lastName: "Silva", address: "1 Main St", apartment: null,
        city: "Austin", state: "TX", zipCode: "73301", country: "US",
    }), ["Ana Silva", "1 Main St", "Austin, TX 73301", "US"]);

    assert.deepEqual(receiptAddressLines({ firstName: "Ana", address: "1 Main St", apartment: "Apt 4", country: "US" }),
        ["Ana", "1 Main St, Apt 4", "US"]);

    assert.deepEqual(receiptAddressLines(null), []);
});

test("every amount on a (USD-only) order is formatted as USD", () => {
    const usd = { ...order, currency: "USD", shipping: "5.00", discount: "4.50", tax: "2.25" };
    const amounts = [
        ...receiptLines(usd).flatMap((line) => [line.unitPrice, line.lineTotal]),
        ...receiptTotals(usd).map((row) => row.value),
    ];

    assert.equal(amounts.length, 8);
    for (const amount of amounts) assert.match(amount, /^-?\$\d{1,3}(,\d{3})*\.\d{2}$/, amount);
});

test("large saved amounts use thousands separators", () => {
    const big = {
        ...order, subtotal: "36999.99", total: "36999.99",
        items: [{ ...order.items[0], quantity: 1, unitPrice: "36999.99", lineTotal: "36999.99" }],
    };

    assert.equal(receiptLines(big)[0].unitPrice, "$36,999.99");
    assert.equal(receiptTotals(big)[0].value, "$36,999.99");
});

test("an order without items yields no lines", () => {
    assert.deepEqual(receiptLines({}), []);
    assert.deepEqual(receiptLines(null), []);
});
