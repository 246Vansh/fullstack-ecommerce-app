import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

import { orderService } from "@/services/orderService";
import { parseApiError } from "@/services/apiClient";

const STATUS_LABELS = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
};

// Formatting only; every value comes from GET /api/orders/:id.
export { formatPrice } from "@/utils/money";

export const formatDate = (value, withTime = false) => new Date(value).toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime && { hour: "numeric", minute: "2-digit" }),
});

export const statusLabel = (status) => STATUS_LABELS[status] ?? status;

// Payment is separate from order status; no provider exists yet, so orders are Unpaid.
const PAYMENT_STATUS_LABELS = {
    UNPAID: "Unpaid",
    PAID: "Paid",
    FAILED: "Failed",
    REFUNDED: "Refunded",
};

export const paymentStatusLabel = (status) => PAYMENT_STATUS_LABELS[status] ?? status;

// Loads the order named in the route (/orderSuccess/:id), so a refresh or a
// shared link shows the persisted order rather than anything kept in memory.
export function useOrderSuccess() {

    const route = useRoute();

    const order = ref(null);
    const loading = ref(true);
    const error = ref("");

    const productCount = computed(() => order.value?.items.length ?? 0);

    const totalQuantity = computed(() =>
        order.value?.items.reduce((total, item) => total + item.quantity, 0) ?? 0
    );

    async function load() {
        const id = route.params.id;

        loading.value = true;
        error.value = "";

        try {
            const data = await orderService.getOrder(id);

            // Ignore a response for an order the user already navigated away from.
            if (route.params.id === id) order.value = data;
        } catch (err) {
            if (route.params.id !== id) return;

            const { status, message } = parseApiError(err);

            order.value = null;
            error.value = status === 404 ? "We couldn't find this order." : message;
        } finally {
            if (route.params.id === id) loading.value = false;
        }
    }

    watch(() => route.params.id, (id) => id && load(), { immediate: true });

    return {
        order,
        loading,
        error,
        productCount,
        totalQuantity,
        load,
    };

}
