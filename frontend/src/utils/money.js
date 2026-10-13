// "$12.50" / "$36,999.99" for display. Every amount comes from the API (or the
// catalog for guest estimates); this only formats it. The store is USD-only
// (orders default to "USD" and nothing sets another currency), so this matches
// the Intl formatter in components/ui/productPrice.vue.
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatPrice = (value) => USD.format(Number(value ?? 0));
