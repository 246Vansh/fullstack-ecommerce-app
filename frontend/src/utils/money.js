// "$12.50" for display. Every amount comes from the API (or the catalog for
// guest estimates); this only formats it.
export const formatPrice = (value) => `$${Number(value ?? 0).toFixed(2)}`;
