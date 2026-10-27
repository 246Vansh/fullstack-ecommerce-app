import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

import { wishlistService } from "@/services/wishlistService";
import { parseApiError } from "@/services/apiClient";
import { useAuthStore } from "./authStore";

/*
| Signed-in users only; the server is the source of truth. The list is
| loaded once per signed-in user (it is small and capped by the server), so
| every product card and the product page read the same `ids` without a
| request each, and a toggle anywhere shows everywhere at once.
|
| Toggles are optimistic: `ids` changes immediately and is put back if the
| request fails. One request per product at a time; a click while one is in
| flight is ignored.
|
| Everything is cleared whenever the signed-in user changes (logout, another
| account in another tab): `generation` is bumped, and a response that
| started for the previous user is dropped on arrival.
*/
export const useWishlistStore = defineStore("wishlist", () => {

    const auth = useAuthStore();

    const ids = ref(new Set());
    // Full products, for the wishlist page.
    const items = ref([]);
    const loaded = ref(false);
    const loading = ref(false);
    const error = ref("");

    const pending = ref(new Set());
    // The last failed toggle: { productId, message }.
    const actionError = ref(null);

    const count = computed(() => ids.value.size);

    let generation = 0;
    let loadRequest = null;

    function reset() {
        generation++;
        loadRequest = null;

        ids.value = new Set();
        items.value = [];
        loaded.value = false;
        loading.value = false;
        error.value = "";
        pending.value = new Set();
        actionError.value = null;
    }

    const has = (productId) => ids.value.has(productId);
    const isPending = (productId) => pending.value.has(productId);

    // Concurrent callers share one request. { force: true } reloads even when
    // already loaded (the wishlist page, for current prices and stock).
    function load({ force = false } = {}) {
        if (!auth.isAuthenticated) return Promise.resolve();
        if (loadRequest) return loadRequest;
        if (loaded.value && !force) return Promise.resolve();

        const started = generation;
        loading.value = true;
        error.value = "";

        const request = wishlistService.list()
            .then((products) => {
                if (started !== generation) return;
                items.value = products;
                // Toggles still in flight keep their optimistic state.
                const next = new Set(products.map((product) => product.id));
                for (const id of pending.value) {
                    if (ids.value.has(id)) next.add(id);
                    else next.delete(id);
                }
                ids.value = next;
                loaded.value = true;
            })
            .catch((err) => {
                if (started === generation) error.value = parseApiError(err).message;
            })
            .finally(() => {
                if (loadRequest !== request) return;
                loadRequest = null;
                loading.value = false;
            });

        loadRequest = request;
        return request;
    }

    function setPending(productId, on) {
        const next = new Set(pending.value);
        if (on) next.add(productId);
        else next.delete(productId);
        pending.value = next;
    }

    function setSaved(productId, saved) {
        const next = new Set(ids.value);
        if (saved) next.add(productId);
        else next.delete(productId);
        ids.value = next;
    }

    // -> true when the product ends up in the requested state.
    async function setInWishlist(productId, saved) {
        if (!auth.isAuthenticated || isPending(productId)) return false;

        const started = generation;
        const was = has(productId);
        const removedItem = items.value.find((product) => product.id === productId);

        setPending(productId, true);
        setSaved(productId, saved);
        if (!saved) items.value = items.value.filter((product) => product.id !== productId);
        actionError.value = null;

        try {
            await (saved ? wishlistService.add(productId) : wishlistService.remove(productId));
            // A product added from a card is not in `items` yet; the wishlist
            // page reloads the full list whenever it is opened.
            return started === generation;
        } catch (err) {
            if (started !== generation) return false;

            setSaved(productId, was);
            if (removedItem && !items.value.some((product) => product.id === productId)) {
                items.value = [...items.value, removedItem].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
            }
            actionError.value = { productId, message: parseApiError(err).message };
            return false;
        } finally {
            if (started === generation) setPending(productId, false);
        }
    }

    const toggle = (productId) => setInWishlist(productId, !has(productId));

    watch(() => auth.user?.id, (userId, previousId) => {
        if (userId !== previousId) {
            reset();
            if (userId) load();
        }
    }, { immediate: true });

    return {
        ids,
        items,
        loaded,
        loading,
        error,
        actionError,
        count,
        has,
        isPending,
        load,
        add: (productId) => setInWishlist(productId, true),
        remove: (productId) => setInWishlist(productId, false),
        toggle,
    };

});
