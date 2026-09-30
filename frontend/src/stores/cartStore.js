import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

import { cartService } from "@/services/cartService";
import { productService } from "@/services/productService";
import { parseApiError } from "@/services/apiClient";
import { readGuestCart, writeGuestCart, GUEST_CART_KEY } from "@/services/guestCartStorage";
import { useAuthStore } from "./authStore";

const EMPTY_CART = { id: null, items: [], itemCount: 0, subtotal: 0 };

// Merge responses that retrying cannot fix (bad input, variant removed, not
// enough stock). The item is kept and reported instead of being retried.
const PERMANENT_MERGE_ERRORS = [400, 404, 409, 422];

const toMoney = (value) => Math.round(value * 100) / 100;

// Same wording as the server, so guest and signed-in errors read alike.
function stockMessage(stock) {
    return stock > 0
        ? `Only ${stock} item${stock === 1 ? "" : "s"} available in stock`
        : "This item is out of stock";
}

const serverQuantity = (serverCart, variantId) =>
    serverCart.items.find((item) => item.variant.id === variantId)?.quantity ?? 0;

// Serializes merges across tabs; one tab merges, the others then find nothing left.
const withMergeLock = (task) =>
    (typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("guest-cart-merge", task) : task());

// Signed-in users: the server cart is the source of truth; every action
// replaces the local state with the cart the API returns.
// Guests: ids and quantities live in localStorage (see guestCartStorage) and
// are displayed with current catalog data. They never hit the cart endpoints.
// After login the guest cart is merged into the server cart.
export const useCartStore = defineStore("cart", () => {

    const auth = useAuthStore();

    const cart = ref(EMPTY_CART);
    const guestItems = ref(readGuestCart());
    // productId -> catalog product, or null when it no longer exists.
    const guestProducts = ref({});
    const loadingCart = ref(false);
    const loadingDetails = ref(false);
    const loading = computed(() => loadingCart.value || loadingDetails.value);
    const updating = ref(false);
    const error = ref("");

    const isGuest = computed(() => !auth.isAuthenticated);

    /*
    |--------------------------------------------------------------------------
    | Guest cart display
    |--------------------------------------------------------------------------
    | Guest items are mapped to the server cart item shape so the cart page
    | renders both the same way. Prices are display estimates from the catalog.
    */

    function toGuestCartItem({ variantId, productId, quantity }) {
        const product = guestProducts.value[productId];
        const variant = product?.variants.find((item) => item.id === variantId);

        return {
            id: variantId,
            quantity,
            unitPrice: variant?.price ?? null,
            originalPrice: variant?.originalPrice ?? null,
            subtotal: variant ? toMoney(variant.price * quantity) : null,
            isAvailable: Boolean(variant) && quantity <= variant.stock,
            product: {
                id: productId,
                // undefined = not loaded yet, null = removed from the catalog.
                name: product?.name ?? (product === null ? "Item no longer available" : "Cart item"),
                brand: product?.brand ?? "",
                image: product?.image ?? null,
                alt: product?.name ?? "",
            },
            variant: {
                id: variantId,
                size: variant?.size ?? null,
                color: variant?.color ?? null,
                colorHex: variant?.colorHex ?? null,
                stock: variant?.stock ?? 0,
            },
        };
    }

    const guestCart = computed(() => {
        // Items whose product is still loading are left out until it arrives.
        const items = guestItems.value
            .filter((item) => guestProducts.value[item.productId] !== undefined)
            .map(toGuestCartItem);

        return {
            id: null,
            items,
            itemCount: guestItems.value.reduce((count, item) => count + item.quantity, 0),
            subtotal: toMoney(items.reduce((sum, item) => sum + (item.subtotal ?? 0), 0)),
        };
    });

    const activeCart = computed(() => (isGuest.value ? guestCart.value : cart.value));

    const items = computed(() => activeCart.value.items);
    const itemCount = computed(() => activeCart.value.itemCount);
    const subtotal = computed(() => activeCart.value.subtotal);
    const isEmpty = computed(() => activeCart.value.items.length === 0);

    // Guest items the server rejected during the merge, shown on the cart page.
    const mergeIssues = computed(() => (isGuest.value ? [] : guestItems.value
        .filter((item) => item.failed)
        .map((item) => {
            const { product, variant } = toGuestCartItem(item);
            const options = [variant.color, variant.size].filter(Boolean).join(" / ");

            return {
                variantId: item.variantId,
                quantity: item.quantity,
                name: options ? `${product.name} (${options})` : product.name,
                message: item.failed,
            };
        })));

    let pendingDetails = null;

    // Fetches catalog data for guest items; `refresh` re-fetches loaded ones too.
    function loadGuestDetails({ refresh = false } = {}) {
        if (pendingDetails) return pendingDetails;

        const ids = [...new Set(guestItems.value.map((item) => item.productId))]
            .filter((id) => refresh || guestProducts.value[id] === undefined);

        if (!ids.length) return Promise.resolve();

        loadingDetails.value = true;

        if (isGuest.value) error.value = "";

        const request = Promise.all(ids.map((id) => productService.getProduct(id).then(
            (product) => ({ id, product }),
            (err) => ({ id, failure: parseApiError(err) }),
        ))).then((results) => {
            const next = { ...guestProducts.value };

            for (const { id, product, failure } of results) {
                if (product) next[id] = product;
                else if (failure.status === 404) next[id] = null;
                else if (isGuest.value) error.value = failure.message;
            }

            guestProducts.value = next;
        }).finally(() => {
            loadingDetails.value = false;
            pendingDetails = null;
        });

        pendingDetails = request;

        return request;
    }

    /*
    |--------------------------------------------------------------------------
    | Guest cart actions
    |--------------------------------------------------------------------------
    | Stock checks here only use the catalog data at hand and are a courtesy;
    | the server enforces stock when the cart is merged.
    */

    function saveGuestItems(next) {
        writeGuestCart(next);
        guestItems.value = next;
    }

    function guestFail(message) {
        error.value = message;
        throw new Error(message);
    }

    function knownStock(variantId, productId) {
        return guestProducts.value[productId]?.variants.find((item) => item.id === variantId)?.stock;
    }

    function addGuestItem(variantId, quantity, { productId, stock } = {}) {
        error.value = "";

        // Re-read so a change made in another tab is not overwritten.
        const current = readGuestCart();
        const existing = current.find((item) => item.variantId === variantId);
        const id = productId ?? existing?.productId;

        if (!id) guestFail("This item could not be added to your cart.");

        const limit = stock ?? knownStock(variantId, id);
        const next = (existing?.quantity ?? 0) + quantity;

        if (limit != null && next > limit) guestFail(stockMessage(limit));

        saveGuestItems(existing
            ? current.map((item) => (item.variantId === variantId ? { ...item, quantity: next } : item))
            : [...current, { variantId, productId: id, quantity }]);
    }

    function updateGuestItem(variantId, quantity) {
        error.value = "";

        const current = readGuestCart();
        const existing = current.find((item) => item.variantId === variantId);

        if (!existing) return;

        const limit = knownStock(variantId, existing.productId);

        if (limit != null && quantity > limit) guestFail(stockMessage(limit));

        saveGuestItems(current.map((item) => (item.variantId === variantId ? { ...item, quantity } : item)));
    }

    function removeGuestItem(variantId) {
        error.value = "";
        saveGuestItems(readGuestCart().filter((item) => item.variantId !== variantId));
    }

    function clearGuestCart() {
        error.value = "";
        saveGuestItems([]);
    }

    // Replaces one stored guest item's fields, or removes it when `change` is null.
    function patchGuestItem(variantId, change) {
        saveGuestItems(readGuestCart().flatMap((item) => {
            if (item.variantId !== variantId) return [item];

            return change ? [{ ...item, ...change }] : [];
        }));
    }

    /*
    |--------------------------------------------------------------------------
    | Guest -> server merge
    |--------------------------------------------------------------------------
    | Each guest item is sent with the normal add endpoint (variantId and
    | quantity only), so the server combines duplicates and enforces stock.
    | An item leaves localStorage as soon as its add succeeds, so a retry never
    | resends finished items. Before sending, `pending` records the server
    | quantity; if the page dies mid-request, the next run compares against it
    | to tell whether that add already landed.
    */

    async function mergeGuestCart(userId) {
        let serverCart = await cartService.getCart();

        for (const item of readGuestCart()) {
            // Signed out (or switched user) mid-merge: leave the rest for later.
            if (auth.user?.id !== userId) return null;

            if (item.failed) continue;

            const current = serverQuantity(serverCart, item.variantId);
            let quantity = item.quantity;

            if (item.pending?.userId === userId && current >= item.pending.baseQty + item.pending.quantity) {
                quantity -= item.pending.quantity;

                if (quantity <= 0) {
                    patchGuestItem(item.variantId, null);
                    continue;
                }
            }

            patchGuestItem(item.variantId, { quantity, pending: { userId, baseQty: current, quantity } });

            try {
                serverCart = await cartService.addToCart(item.variantId, quantity);
                patchGuestItem(item.variantId, null);
            } catch (err) {
                // No response: the add may have been applied, so `pending` stays
                // for the next run to check. Stop and keep the remaining items.
                if (!err.response) throw err;

                const { status, message } = parseApiError(err);
                const permanent = PERMANENT_MERGE_ERRORS.includes(status);

                patchGuestItem(item.variantId, { pending: undefined, ...(permanent && { failed: message }) });

                if (!permanent) throw err;
            }
        }

        return cartService.getCart();
    }

    /*
    |--------------------------------------------------------------------------
    | Server cart
    |--------------------------------------------------------------------------
    */

    // Called on logout: drops the server cart and shows the guest cart again.
    // Items the merge rejected become ordinary guest items once more.
    function reset() {
        cart.value = EMPTY_CART;
        error.value = "";

        const stored = readGuestCart();

        if (stored.some((item) => item.failed)) {
            writeGuestCart(stored.map(({ failed, ...item }) => item));
        }

        guestItems.value = readGuestCart();
    }

    let pendingLoad = null;
    let pendingUserId = null;

    // Concurrent callers (auth watcher + cart page) share one request, so a
    // login triggers a single merge.
    function loadCart() {
        if (!auth.isAuthenticated) return loadGuestDetails({ refresh: true });

        if (pendingLoad && pendingUserId === auth.user.id) return pendingLoad;

        pendingUserId = auth.user.id;

        const request = fetchCart().finally(() => {
            if (pendingLoad === request) pendingLoad = null;
        });

        pendingLoad = request;

        return request;
    }

    async function fetchCart() {
        const userId = auth.user.id;

        loadingCart.value = true;
        error.value = "";

        try {
            const hasGuestItems = readGuestCart().some((item) => !item.failed);

            const data = hasGuestItems
                ? await withMergeLock(() => mergeGuestCart(userId))
                : await cartService.getCart();

            // Ignore a response that arrives after logout or a user switch.
            if (data && auth.user?.id === userId) cart.value = data;
        } catch (err) {
            error.value = parseApiError(err).message;
        } finally {
            guestItems.value = readGuestCart();
            loadingCart.value = false;
        }
    }

    // Runs a mutation and stores the cart it returns. Errors are kept in
    // `error` and re-thrown so the caller can react (e.g. the product page).
    async function mutate(request) {
        updating.value = true;
        error.value = "";

        try {
            cart.value = await request();
        } catch (err) {
            error.value = parseApiError(err).message;
            throw err;
        } finally {
            updating.value = false;
        }
    }

    // For signed-in users `itemId` is the cart item id; for guests it is the
    // variant id (the guest cart item's id). `options.productId` is required
    // for a guest's first add of a variant; `options.stock` is a courtesy check.
    const addItem = async (variantId, quantity, options) => (isGuest.value
        ? addGuestItem(variantId, quantity, options)
        : mutate(() => cartService.addToCart(variantId, quantity)));

    const updateItem = async (itemId, quantity) => (isGuest.value
        ? updateGuestItem(itemId, quantity)
        : mutate(() => cartService.updateCartItem(itemId, quantity)));

    const removeItem = async (itemId) => (isGuest.value
        ? removeGuestItem(itemId)
        : mutate(() => cartService.removeCartItem(itemId)));

    const clearCart = async () => (isGuest.value ? clearGuestCart() : mutate(() => cartService.clearCart()));

    // Retries the rejected items (e.g. after stock was replenished).
    function retryMerge() {
        writeGuestCart(readGuestCart().map(({ failed, ...item }) => item));
        guestItems.value = readGuestCart();

        return loadCart();
    }

    function dismissMergeIssues() {
        saveGuestItems(readGuestCart().filter((item) => !item.failed));
    }

    // Load (and merge) after login or a restored session, show the guest cart after logout.
    watch(() => auth.user?.id, (userId) => (userId ? loadCart() : reset()), { immediate: true });

    // Fetch catalog data for guest items that have none yet (new adds, merge failures).
    watch(guestItems, (stored) => {
        if (isGuest.value ? stored.length : stored.some((item) => item.failed)) loadGuestDetails();
    });

    // Keep the badge and cart in sync with changes made in other tabs.
    if (typeof window !== "undefined") {
        window.addEventListener("storage", (event) => {
            if (event.key === GUEST_CART_KEY || event.key === null) guestItems.value = readGuestCart();
        });
    }

    return {
        cart,
        items,
        itemCount,
        subtotal,
        isEmpty,
        isGuest,
        mergeIssues,
        loading,
        updating,
        error,
        loadCart,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        retryMerge,
        dismissMergeIssues,
    };

});
