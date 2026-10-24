<template>
    <AdminBadge :tone="TONES[status] ?? 'neutral'">{{ statusLabel(status) }}</AdminBadge>
</template>

<script setup>
import AdminBadge from "./adminBadge.vue";
import { statusLabel } from "@/composables/useOrderSuccess";

defineProps({
    status: { type: String, required: true },
});

// Colour only; the statuses and their labels are the OrderStatus enum's.
// Waiting on the store: amber. In progress: blue. Done: green. Stopped: red/grey.
const TONES = {
    PENDING: "warning",
    CONFIRMED: "info",
    PROCESSING: "info",
    SHIPPED: "brand",
    DELIVERED: "success",
    CANCELLED: "danger",
    REFUNDED: "neutral",
};
</script>
