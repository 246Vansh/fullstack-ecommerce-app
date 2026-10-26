<template>

    <!-- A status this page does not know shows no card rather than an empty one. -->
    <section v-if="closed || reached !== undefined" class="rounded-panel border border-slate-200 bg-white p-5 sm:p-6"
        aria-labelledby="order-progress-heading">

        <h2 id="order-progress-heading" class="text-base font-semibold text-slate-900">
            Order progress
        </h2>

        <!-- Cancelled / refunded orders never show fulfilment steps. -->
        <div v-if="closed" class="mt-4 flex items-start gap-3 rounded-card bg-slate-50 p-4">
            <XCircleIcon v-if="status === 'CANCELLED'" class="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <ArrowUturnLeftIcon v-else class="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
            <div class="text-sm">
                <p class="font-semibold text-slate-900">{{ closed.title }}</p>
                <p class="mt-0.5 text-slate-600">{{ closed.note }}</p>
            </div>
        </div>

        <!-- Steps come only from the stored order status; no stage is implied
             before the server reports it. -->
        <ol v-else class="mt-5 grid grid-cols-4" aria-label="Order progress">

            <li v-for="(stage, index) in STAGES" :key="stage" class="relative flex flex-col items-center px-1 text-center"
                :aria-current="index === reached ? 'step' : undefined">

                <!-- Connector to the next step -->
                <span v-if="index < STAGES.length - 1" aria-hidden="true"
                    class="absolute top-3.5 left-1/2 h-1 w-full -translate-y-1/2 rounded-full"
                    :class="index < reached ? 'bg-brand' : 'bg-slate-300'" />

                <!-- Completed: filled with a check. Next: brand ring with a dot. Later: grey ring. -->
                <span aria-hidden="true"
                    class="relative flex h-7 w-7 items-center justify-center rounded-full"
                    :class="index <= reached
                        ? 'bg-brand text-white ring-4 ring-white'
                        : index === reached + 1
                            ? 'border-2 border-brand bg-white ring-4 ring-brand-soft'
                            : 'border-2 border-slate-300 bg-white ring-4 ring-white'">
                    <CheckIcon v-if="index <= reached" class="h-4 w-4" stroke-width="3" />
                    <span v-else-if="index === reached + 1" class="h-2 w-2 rounded-full bg-brand" />
                </span>

                <!-- Columns are ~60px wide on a 320px phone: long words wrap instead of overlapping. -->
                <span class="mt-2.5 text-xs font-semibold wrap-anywhere sm:text-sm"
                    :class="index <= reached ? 'text-slate-900' : index === reached + 1 ? 'text-slate-700' : 'text-slate-500'">
                    {{ stage }}
                    <span class="sr-only">{{ index <= reached ? "(completed)" : "(not yet)" }}</span>
                </span>

                <span v-if="captions[index]" class="mt-0.5 text-xs text-slate-500 wrap-anywhere">
                    {{ captions[index] }}
                </span>

            </li>

        </ol>

    </section>

</template>

<script setup>
import { computed } from "vue";
import { ArrowUturnLeftIcon, CheckIcon, XCircleIcon } from "@heroicons/vue/24/outline";

import { formatDate } from "@/composables/useOrderSuccess";

const props = defineProps({
    order: {
        type: Object,
        required: true,
    },
});

const STAGES = ["Order placed", "Confirmed", "Shipped", "Delivered"];

// Last stage each OrderStatus has actually reached. PROCESSING is a confirmed
// order being prepared; it has not shipped. Unknown statuses show no steps.
const REACHED = {
    PENDING: 0,
    CONFIRMED: 1,
    PROCESSING: 1,
    SHIPPED: 2,
    DELIVERED: 3,
};

const status = computed(() => props.order.status);
const reached = computed(() => REACHED[status.value]);

const closed = computed(() => {
    if (status.value === "CANCELLED") {
        return { title: "Order cancelled", note: `Cancelled ${formatDate(props.order.updatedAt, true)}.` };
    }
    if (status.value === "REFUNDED") {
        return { title: "Order refunded", note: "This order has been refunded." };
    }
    return null;
});

// Only dates the order stores (placed) and states it reports; no estimates.
const captions = computed(() => {
    const result = { 0: formatDate(props.order.createdAt) };

    if (status.value === "PENDING") {
        result[1] = props.order.paymentMethod === "RAZORPAY" && props.order.paymentStatus !== "PAID"
            ? "Awaiting payment"
            : "Awaiting confirmation";
    }
    if (status.value === "PROCESSING") result[1] = "Being prepared";

    return result;
});
</script>
