import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

import { cartService } from "@/services/cartService";
import { parseApiError } from "@/services/apiClient";
import { useAuthStore } from "./authStore";

const EMPTY_CART = { id: null, items: [], itemCount: 0, subtotal: 0 };

// The server cart is the source of truth: every action replaces the local
// state with the cart the API returns, so prices and totals are never
// calculated here. Guests have no cart and never hit the cart endpoints.
export const useCartStore = defineStore("cart", () => {

    const auth = useAuthStore();

    const cart = ref(EMPTY_CART);
    const loading = ref(false);
    const updating = ref(false);
    const error = ref("");

    const items = computed(() => cart.value.items);
    const itemCount = computed(() => cart.value.itemCount);
    const subtotal = computed(() => cart.value.subtotal);
    const isEmpty = computed(() => cart.value.items.length === 0);

    function reset() {
        cart.value = EMPTY_CART;
        error.value = "";
    }

    let pendingLoad = null;
    let pendingUserId = null;

    // Concurrent callers (header + cart page on first load) share one request.
    function loadCart() {
        if (!auth.isAuthenticated) return reset();

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

        loading.value = true;
        error.value = "";

        try {
            const data = await cartService.getCart();

            // Ignore a response that arrives after logout or a user switch.
            if (auth.user?.id === userId) cart.value = data;
        } catch (err) {
            error.value = parseApiError(err).message;
        } finally {
            loading.value = false;
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

    const addItem = (variantId, quantity) => mutate(() => cartService.addToCart(variantId, quantity));
    const updateItem = (itemId, quantity) => mutate(() => cartService.updateCartItem(itemId, quantity));
    const removeItem = (itemId) => mutate(() => cartService.removeCartItem(itemId));
    const clearCart = () => mutate(() => cartService.clearCart());

    // Load after login or a restored session, clear after logout.
    watch(() => auth.user?.id, (userId) => (userId ? loadCart() : reset()), { immediate: true });

    return {
        cart,
        items,
        itemCount,
        subtotal,
        isEmpty,
        loading,
        updating,
        error,
        loadCart,
        addItem,
        updateItem,
        removeItem,
        clearCart,
    };

});
