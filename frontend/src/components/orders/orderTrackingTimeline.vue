<template>

    <section class="rounded-panel border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="tracking-timeline-heading">

        <h2 id="tracking-timeline-heading" class="text-base font-semibold text-slate-900">
            Tracking history
        </h2>

        <!-- A status the server could not place on the timeline. -->
        <p v-if="!order.timeline?.length" class="mt-4 rounded-card bg-slate-50 p-4 text-sm text-slate-600">
            Tracking details aren't available for this order yet.
        </p>

        <!-- Steps and dates come only from the server; nothing is estimated here. -->
        <ol v-else class="mt-5" aria-label="Tracking history">

            <li v-for="(entry, index) in order.timeline" :key="entry.step" class="relative flex gap-4 pb-6 last:pb-0"
                :aria-current="entry.state === 'current' ? 'step' : undefined">

                <!-- Connector to the next step -->
                <span v-if="index < order.timeline.length - 1" aria-hidden="true"
                    class="absolute top-8 bottom-0 left-3.5 w-0.5 -translate-x-1/2 rounded-full"
                    :class="entry.state === 'upcoming' || order.timeline[index + 1].state === 'upcoming' ? 'bg-slate-200' : 'bg-brand'" />

                <!-- Completed: filled check. Current: filled (or red for a closed order). Upcoming: grey ring. -->
                <span aria-hidden="true" class="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    :class="dotClass(entry)">
                    <XMarkIcon v-if="isClosed(entry)" class="h-4 w-4" stroke-width="3" />
                    <CheckIcon v-else-if="entry.state !== 'upcoming'" class="h-4 w-4" stroke-width="3" />
                </span>

                <div class="min-w-0 pt-0.5">
                    <p class="text-sm font-semibold sm:text-base"
                        :class="entry.state === 'upcoming' ? 'text-slate-500' : isClosed(entry) ? 'text-red-700' : 'text-slate-900'">
                        {{ STEP_LABELS[entry.step] ?? entry.step }}
                        <span class="sr-only">({{ STATE_LABELS[entry.state] }})</span>
                    </p>

                    <p v-if="entry.at" class="mt-0.5 text-xs text-slate-500 sm:text-sm">
                        <time :datetime="entry.at">{{ formatDate(entry.at, true) }}</time>
                    </p>

                    <p v-if="describe(entry)" class="mt-1 text-sm text-slate-600">
                        {{ describe(entry) }}
                    </p>
                </div>

            </li>

        </ol>

    </section>

</template>

<script setup>
import { CheckIcon, XMarkIcon } from "@heroicons/vue/24/outline";

import { formatDate } from "@/composables/useOrderSuccess";

const props = defineProps({
    // GET /api/orders/:id/tracking
    order: {
        type: Object,
        required: true,
    },
});

const STEP_LABELS = {
    PENDING: "Order placed",
    CONFIRMED: "Confirmed",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    REFUNDED: "Refunded",
};

const STATE_LABELS = { completed: "completed", current: "current status", upcoming: "not yet" };

const isClosed = (entry) => entry.step === "CANCELLED" || entry.step === "REFUNDED";

function dotClass(entry) {
    if (isClosed(entry)) return "bg-red-600 text-white ring-4 ring-red-50";
    if (entry.state === "current") return "bg-brand text-white ring-4 ring-brand-soft";
    if (entry.state === "completed") return "bg-brand text-white ring-4 ring-white";
    return "border-2 border-slate-300 bg-white ring-4 ring-white";
}

// One line per step, only for steps the order has reached or is waiting on.
function describe(entry) {
    const { order } = props;

    switch (entry.step) {
        case "PENDING":
            if (entry.state !== "current") return "We received your order.";
            return order.awaitingPayment
                ? "Waiting for your online payment before the order can be confirmed."
                : "Waiting for the store to confirm your order.";
        case "CONFIRMED":
            return entry.state === "upcoming" ? "" : "Your order has been confirmed.";
        case "PROCESSING":
            return entry.state === "upcoming" ? "" : "Your order is being prepared for shipment.";
        case "SHIPPED":
            return entry.state === "upcoming" ? "" : "Your order has left the store.";
        case "DELIVERED":
            return entry.state === "upcoming" ? "" : "Your order has been delivered.";
        case "CANCELLED":
            return order.expired
                ? "Cancelled automatically because the payment wasn't completed within 30 minutes."
                : "This order was cancelled and its items were released.";
        case "REFUNDED":
            return "This order has been refunded.";
        default:
            return "";
    }
}
</script>
