import { STORAGE_KEYS } from "@/config/storage";

// Guest cart persisted in localStorage under "cart":
//
//   { "items": [{ "variantId": 12, "productId": 4, "quantity": 2 }] }
//
// Only ids and quantities are stored. productId is a lookup key for the
// catalog API (there is no variant endpoint); prices and stock are always
// fetched fresh. Two optional fields are used while merging after login:
//   pending: { userId, baseQty, quantity } - an add was sent for this user (see cartStore)
//   failed:  "message"            - the server rejected the item (stock, removed)

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

function sanitize(item) {
    if (!item || !isPositiveInt(item.variantId) || !isPositiveInt(item.productId) || !isPositiveInt(item.quantity)) {
        return null;
    }

    const clean = { variantId: item.variantId, productId: item.productId, quantity: item.quantity };

    const { pending } = item;

    if (pending && isPositiveInt(pending.userId) && Number.isInteger(pending.baseQty) && isPositiveInt(pending.quantity)) {
        clean.pending = { userId: pending.userId, baseQty: pending.baseQty, quantity: pending.quantity };
    }

    if (typeof item.failed === "string" && item.failed) clean.failed = item.failed;

    return clean;
}

export function readGuestCart() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.CART));

        return (Array.isArray(parsed?.items) ? parsed.items : []).map(sanitize).filter(Boolean);
    } catch {
        return [];
    }
}

export function writeGuestCart(items) {
    try {
        if (items.length) {
            localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify({ items }));
        } else {
            localStorage.removeItem(STORAGE_KEYS.CART);
        }
    } catch {
        // Storage unavailable (private mode, quota): the cart lives in memory only.
    }
}

export const GUEST_CART_KEY = STORAGE_KEYS.CART;
