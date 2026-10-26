<template>

    <section class="rounded-panel border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="order-summary-heading">

        <h2 id="order-summary-heading" class="text-base font-semibold text-slate-900">
            Order summary
        </h2>

        <!-- Totals: stored on the order when it was placed -->
        <dl class="mt-4 space-y-3 text-sm">
            <div v-for="row in totals" :key="row.label" class="flex items-baseline justify-between gap-4">
                <dt class="text-slate-600">{{ row.label }}</dt>
                <dd class="font-medium tabular-nums text-slate-900">{{ row.value }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-4 border-t border-slate-200 pt-4">
                <dt class="text-base font-semibold text-slate-900">Total</dt>
                <dd class="text-xl font-semibold tracking-tight tabular-nums text-slate-900">
                    {{ formatPrice(order.total, order.currency) }}
                </dd>
            </div>
        </dl>

        <dl class="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm">
            <div class="flex items-center justify-between gap-4">
                <dt class="text-slate-600">Payment</dt>
                <dd>
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        :class="PAYMENT_COLORS[order.paymentStatus] ?? 'bg-slate-100 text-slate-700'">
                        {{ paymentStatusLabel(order.paymentStatus) }}
                    </span>
                </dd>
            </div>
            <div v-if="order.paymentMethod" class="flex items-center justify-between gap-4">
                <dt class="text-slate-600">Payment method</dt>
                <dd class="text-right font-medium text-slate-900">{{ paymentMethodLabel(order.paymentMethod) }}</dd>
            </div>
        </dl>

    </section>

</template>

<script setup>
import { computed } from "vue";

import { formatPrice, paymentMethodLabel, paymentStatusLabel } from "@/composables/useOrderSuccess";

const props = defineProps({
    order: {
        type: Object,
        required: true,
    },
});

const PAYMENT_COLORS = {
    PAID: "bg-brand-soft text-brand",
    UNPAID: "bg-amber-50 text-amber-800",
    FAILED: "bg-red-50 text-red-700",
};

const totals = computed(() => [
    { label: "Subtotal", value: formatPrice(props.order.subtotal, props.order.currency) },
    { label: "Shipping", value: formatPrice(props.order.shipping, props.order.currency) },
    { label: "Tax", value: formatPrice(props.order.tax, props.order.currency) },
    ...(Number(props.order.discount) > 0 ? [{ label: "Discount", value: `-${formatPrice(props.order.discount, props.order.currency)}` }] : []),
]);
</script>
