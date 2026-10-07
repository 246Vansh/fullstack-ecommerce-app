<template>
    <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="COLORS[status] ?? 'bg-slate-100 text-slate-700'">
        {{ statusLabel(status) }}
    </span>
</template>

<script setup>
import { statusLabel } from "@/composables/useOrderSuccess";

defineProps({
    status: {
        type: String,
        required: true,
    },
});

const COLORS = {
    PENDING: "bg-amber-100 text-amber-700",
    CANCELLED: "bg-red-100 text-red-700",
    DELIVERED: "bg-green-100 text-green-700",
};
</script>
