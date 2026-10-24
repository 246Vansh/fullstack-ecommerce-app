<template>

    <section class="rounded-panel border border-slate-200 bg-white p-5 sm:p-8">

        <div class="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">

            <!-- State icon -->

            <span :class="['flex h-14 w-14 shrink-0 items-center justify-center rounded-full', view.iconClass]">
                <component :is="view.icon" class="h-7 w-7" aria-hidden="true" />
            </span>

            <div class="min-w-0 flex-1">

                <!-- Heading: only what the stored order says (never "paid" before the server verified it). -->
                <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    {{ view.title }}
                </h1>

                <p class="mt-2 max-w-2xl text-base text-slate-600">
                    {{ view.message }}
                </p>

                <!-- Order reference -->

                <div class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">

                    <div class="inline-flex items-center gap-1 rounded-control border border-slate-200 bg-surface pl-3">
                        <span class="text-slate-600">Order</span>
                        <span class="font-semibold text-slate-900 wrap-anywhere">#{{ order.orderNumber }}</span>
                        <button type="button" :title="copied ? 'Copied' : 'Copy order number'" aria-label="Copy order number"
                            class="ml-1 flex h-10 w-10 items-center justify-center rounded-control text-slate-500 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer"
                            @click="copyOrderNumber">
                            <CheckIcon v-if="copied" class="h-5 w-5 text-brand" aria-hidden="true" />
                            <DocumentDuplicateIcon v-else class="h-5 w-5" aria-hidden="true" />
                        </button>
                        <span role="status" class="sr-only">{{ copied ? "Order number copied" : "" }}</span>
                    </div>

                    <p class="text-slate-600">
                        Placed {{ formatDate(order.createdAt, true) }}
                    </p>

                </div>

                <!-- Statuses, as stored on the order -->

                <dl class="mt-5 grid gap-3 text-sm sm:grid-cols-3">

                    <div class="rounded-control bg-surface px-4 py-3">
                        <dt class="text-slate-600">Order status</dt>
                        <dd class="mt-0.5 font-semibold text-slate-900">{{ statusLabel(order.status) }}</dd>
                    </div>

                    <div class="rounded-control bg-surface px-4 py-3">
                        <dt class="text-slate-600">Payment</dt>
                        <dd class="mt-0.5 font-semibold" :class="order.paymentStatus === 'PAID' ? 'text-brand' : 'text-slate-900'">
                            {{ paymentStatusLabel(order.paymentStatus) }}
                        </dd>
                    </div>

                    <div class="rounded-control bg-surface px-4 py-3">
                        <dt class="text-slate-600">Total</dt>
                        <dd class="mt-0.5 font-semibold text-slate-900">{{ formatPrice(order.total, order.currency) }}</dd>
                    </div>

                </dl>

            </div>

        </div>

    </section>

</template>

<script setup>
import { computed, ref } from "vue";
import {
    CheckIcon,
    ClockIcon,
    DocumentDuplicateIcon,
    XMarkIcon,
} from "@heroicons/vue/24/outline";

import { formatDate, formatPrice, paymentStatusLabel, statusLabel } from "@/composables/useOrderSuccess";

const props = defineProps({

    order: {
        type: Object,
        required: true,
    },

    productCount: Number,

    totalQuantity: Number,

});

// The heading and message for the order as the server stored it:
// cancelled, an online order without a verified payment, a verified online
// payment, or cash on delivery.
const view = computed(() => {
    const { order } = props;
    const total = formatPrice(order.total, order.currency);

    if (order.status === "CANCELLED") {
        return {
            icon: XMarkIcon,
            iconClass: "bg-slate-100 text-slate-600",
            title: "This order was cancelled",
            message: "Nothing more is needed for this order.",
        };
    }

    if (order.paymentMethod === "RAZORPAY" && order.paymentStatus !== "PAID") {
        return {
            icon: ClockIcon,
            iconClass: "bg-amber-100 text-amber-700",
            title: "Your order is waiting for payment",
            message: order.payable
                ? "We've saved your order, but no payment has been received yet. You can pay for it from the order page."
                : "We couldn't confirm a payment for this order yet. Check the order page for its latest status.",
        };
    }

    if (order.paymentMethod === "RAZORPAY") {
        return {
            icon: CheckIcon,
            iconClass: "bg-brand text-white",
            title: "Thank you! Your payment was received",
            message: `We've verified your payment of ${total} and received your order.`,
        };
    }

    return {
        icon: CheckIcon,
        iconClass: "bg-brand text-white",
        title: "Thank you! Your order has been placed",
        message: `You'll pay ${total} in cash when your order arrives. No payment has been taken yet.`,
    };
});

const copied = ref(false);

async function copyOrderNumber() {
    try {
        await navigator.clipboard.writeText(props.order.orderNumber);
        copied.value = true;
        setTimeout(() => { copied.value = false; }, 2000);
    } catch {
        // Clipboard unavailable (permissions / insecure context): nothing to do.
    }
}
</script>
