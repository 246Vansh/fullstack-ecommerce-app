// "$12.50" / "₹1,00,000.00" for display. Every amount comes from the API (or
// the catalog for guest estimates) together with its currency: a product's
// `currency`, a cart or checkout `currency`, or an order's stored `currency`.
// This only formats it; nothing is ever converted between currencies.
//
// The currency is required. A historical USD order stays "$" because its
// stored currency is "USD", never because USD is assumed. A missing or unknown
// currency (e.g. a cart mixing currencies) shows a dash, not a guessed symbol.
const FORMATTERS = {
    USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
    INR: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }),
};

export const UNKNOWN_PRICE = "—";

export function formatPrice(value, currency) {
    const formatter = FORMATTERS[currency];

    return formatter ? formatter.format(Number(value ?? 0)) : UNKNOWN_PRICE;
}
