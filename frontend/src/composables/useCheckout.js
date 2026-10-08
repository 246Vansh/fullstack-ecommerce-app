import { ref, computed } from "vue";
import { useRouter } from "vue-router";

import { checkoutService } from "@/services/checkoutService";
import { addressService } from "@/services/addressService";
import { orderService } from "@/services/orderService";
import { parseApiError } from "@/services/apiClient";
import { useCartStore } from "@/stores/cartStore";

// Checkout page state. Everything shown comes from GET /api/checkout; the
// page only formats the server's prices and totals, it never computes them.
export function useCheckout() {

    const cart = useCartStore();
    const router = useRouter();

    const checkout = ref(null);
    const loading = ref(false);
    const error = ref("");

    const items = computed(() => checkout.value?.items ?? []);
    const summary = computed(() => checkout.value?.summary ?? null);
    const addresses = computed(() => checkout.value?.addresses ?? []);
    const validation = computed(() => checkout.value?.validation ?? null);
    const selectedAddressId = computed(() => checkout.value?.selectedAddressId ?? null);
    const selectedAddress = computed(() =>
        addresses.value.find((address) => address.id === selectedAddressId.value) ?? null
    );

    let latest = 0;

    async function load(addressId = selectedAddressId.value) {
        const request = ++latest;

        loading.value = true;
        error.value = "";

        try {
            // First load waits for a guest-cart merge still running after
            // login, so the checkout reflects the merged server cart.
            if (!checkout.value) await cart.loadCart();

            const data = await checkoutService.getCheckout(addressId);

            // Only the most recent request wins (e.g. quick address switches).
            if (request === latest) checkout.value = data;
        } catch (err) {
            if (request === latest) error.value = parseApiError(err).message;
        } finally {
            if (request === latest) loading.value = false;
        }
    }

    // The server re-prices for the chosen address (shipping/tax may depend on it later).
    function selectAddress(id) {
        if (id !== selectedAddressId.value) return load(id);
    }

    // Creates or updates an address, then selects it. Errors are re-thrown for the form.
    async function saveAddress(fields, id = null) {
        const saved = id
            ? await addressService.updateAddress(id, fields)
            : await addressService.createAddress(fields);

        await load(saved.id);

        return saved;
    }

    // Deletes a saved address; the server then picks the shipping address
    // (the deleted one is never kept selected). Errors are re-thrown for the card.
    async function deleteAddress(id) {
        await addressService.deleteAddress(id);

        await load(id === selectedAddressId.value ? null : selectedAddressId.value);
    }

    const placing = ref(false);
    const placeError = ref("");

    // Sends only the address id; the server re-validates, prices and creates
    // the order atomically. `placing` is set before the request, so a double
    // click (even before the button re-renders as disabled) sends one request.
    async function placeOrder() {
        if (placing.value || !validation.value?.canProceed || !selectedAddressId.value) return;

        placing.value = true;
        placeError.value = "";

        try {
            // The displayed server total is sent only as a check, never as the price.
            const order = await orderService.createOrder(selectedAddressId.value, summary.value?.total);

            // The server emptied the cart; resync the header badge.
            cart.loadCart();

            await router.push({ name: "orderSuccess", params: { id: order.id } });
        } catch (err) {
            placeError.value = parseApiError(err).message;

            // Stock or availability changed: reload so the affected items are shown.
            if (err.response?.status === 409) await load();

            placing.value = false;
        }
    }

    return {
        checkout,
        items,
        summary,
        addresses,
        validation,
        selectedAddressId,
        selectedAddress,
        loading,
        error,
        load,
        selectAddress,
        saveAddress,
        deleteAddress,
        placing,
        placeError,
        placeOrder,
    };

}
