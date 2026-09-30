import { Prisma } from "@prisma/client";

// Single place for checkout charges. Development rules for now: no shipping,
// tax or discount. Replace a rule here (it receives the priced items and the
// selected address) and checkout, and later order creation, pick it up.

const ZERO = new Prisma.Decimal(0);

const rules = {
    shipping: (/* { items, subtotal, address } */) => ZERO,
    tax: (/* { items, subtotal, address } */) => ZERO,
    discount: (/* { items, subtotal, address } */) => ZERO,
};

export const toMoney = (value) => new Prisma.Decimal(value).toDecimalPlaces(2).toNumber();

// items: [{ unitPrice: Decimal, quantity }] - prices must come from the database.
export function calculateTotals(items, { address = null } = {}) {
    const subtotal = items.reduce((sum, item) => sum.add(item.unitPrice.mul(item.quantity)), ZERO);
    const context = { items, subtotal, address };

    const shipping = rules.shipping(context);
    const tax = rules.tax(context);
    const discount = rules.discount(context);

    return {
        subtotal: toMoney(subtotal),
        shipping: toMoney(shipping),
        tax: toMoney(tax),
        discount: toMoney(discount),
        total: toMoney(subtotal.add(shipping).add(tax).sub(discount)),
    };
}
