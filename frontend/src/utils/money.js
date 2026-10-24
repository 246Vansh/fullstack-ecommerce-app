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

const WHOLE_FORMATTERS = {
    USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
    INR: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }),
};

// "$25" / "₹2,500" for round amounts such as price-filter bounds. Without a
// known currency (none given, or results in several) it is the bare number,
// never a guessed symbol.
export function formatWholePrice(value, currency) {
    const formatter = WHOLE_FORMATTERS[currency];

    return formatter ? formatter.format(Number(value ?? 0)) : Number(value ?? 0).toLocaleString("en-US");
}

// Whole-percent markdown ("20" for 80 off 100); 0 when there is no original
// price or it is not above the current one. Any real markdown is at least 1.
export function discountPercent(price, originalPrice) {
    const current = Number(price ?? 0);
    const original = Number(originalPrice ?? 0);

    if (!original || original <= current) return 0;

    return Math.max(1, Math.round(((original - current) / original) * 100));
}
