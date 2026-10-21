import { Prisma } from "@prisma/client";

/*
|--------------------------------------------------------------------------
| Pricing: the single place where money is decided.
|--------------------------------------------------------------------------
| Unit price:  a variant's own price if it has one, else its product's price.
| Shipping:    flat 0.00 for every order (no carrier or zone pricing yet).
| Tax:         0% (no tax policy is defined yet).
| Discount:    none (there is no coupon or promotion system).
| Total:       subtotal + shipping + tax - discount.
|
| Checkout and order creation both call calculateTotals, so the total shown
| at checkout is the total stored on the order. To change a policy, replace
| its rule below; each receives { items, subtotal, address }.
|
| All arithmetic uses Prisma.Decimal (never JS numbers). Each component is
| rounded to cents with ROUND_HALF_UP before the total is summed, so the
| stored components always add up exactly to the stored total.
|
| Currency: every price is in its product's currency (Product.currency, set
| when the product is created and never changed). A cart, a checkout and an
| order each have exactly one currency; amounts in different currencies are
| never added together, and nothing is ever converted between currencies.
*/

const { Decimal } = Prisma;

// The currencies a product can be priced in. Both use 2 decimal places.
export const CURRENCIES = ["USD", "INR"];

export const MIXED_CURRENCY = "MIXED_CURRENCY";

export const MIXED_CURRENCY_MESSAGE = "Items priced in different currencies can't be bought together. Check out or remove the items already in your cart first.";

// The one currency of a cart's products: null when there are none or when
// they are priced in more than one currency (which must never be totalled).
export function currencyOf(products) {
    const currencies = new Set(products.map((product) => product.currency));

    return currencies.size === 1 ? [...currencies][0] : null;
}

const ZERO = new Decimal(0);

const TAX_RATE = new Decimal(0);

const rules = {
    shipping: (/* { items, subtotal, address } */) => ZERO,
    tax: ({ subtotal }) => subtotal.mul(TAX_RATE),
    discount: (/* { items, subtotal, address } */) => ZERO,
};

export const roundMoney = (value) => new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

// For JSON responses only: Decimal -> number of cents precision.
export const toMoney = (value) => roundMoney(value).toNumber();

// The one rule for what a variant costs (product detail, cart, checkout, orders).
export const unitPriceOf = (variant, product) => roundMoney(variant.price ?? product.price);

export const originalPriceOf = (variant, product) => {
    const value = variant.originalPrice ?? product.originalPrice;

    return value == null ? null : roundMoney(value);
};

export const lineTotalOf = (unitPrice, quantity) => roundMoney(new Decimal(unitPrice).mul(quantity));

// items: [{ unitPrice: Decimal, quantity }] - prices must come from the database.
// Returns Decimals; use serializeTotals for API responses.
export function calculateTotals(items, { address = null } = {}) {
    const subtotal = items.reduce((sum, item) => sum.add(lineTotalOf(item.unitPrice, item.quantity)), ZERO);
    const context = { items, subtotal, address };

    const shipping = roundMoney(rules.shipping(context));
    const tax = roundMoney(rules.tax(context));
    const discount = roundMoney(rules.discount(context));
    const total = subtotal.add(shipping).add(tax).sub(discount);

    if (shipping.isNegative() || tax.isNegative() || discount.isNegative() || total.isNegative()) {
        throw new Error("Pricing rules produced a negative amount");
    }

    return { subtotal, shipping, tax, discount, total };
}

export function serializeTotals(totals) {
    return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, toMoney(value)]));
}
