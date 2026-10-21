// One currency per cart, for the guest cart (the server enforces the same rule
// for signed-in carts in cartService.addItem and at checkout). Amounts in
// different currencies are never added together and never converted.

// Same wording as the server (pricingService.MIXED_CURRENCY_MESSAGE).
export const MIXED_CURRENCY_MESSAGE = "Items priced in different currencies can't be bought together. Check out or remove the items already in your cart first.";

// { currency, mixedCurrency } of a cart from its items' currencies. Unknown
// (null) currencies, e.g. a product removed from the catalog, are skipped.
export function cartCurrencyOf(currencies) {
    const known = new Set(currencies.filter(Boolean));

    return {
        currency: known.size === 1 ? [...known][0] : null,
        mixedCurrency: known.size > 1,
    };
}

// True when adding a product in `currency` would put a second currency in the
// stored cart. `currencyOfItem` gives a stored item's currency, or undefined
// when it is not known yet; such an item is not counted (the server checks
// again when the guest cart is merged after login).
export function addsSecondCurrency(storedItems, { variantId, currency }, currencyOfItem) {
    if (!currency) return false;

    return storedItems.some((item) => item.variantId !== variantId && (currencyOfItem(item) ?? currency) !== currency);
}
