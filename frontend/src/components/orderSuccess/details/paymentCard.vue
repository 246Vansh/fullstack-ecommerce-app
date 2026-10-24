<template>

    <section class="rounded-panel border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="success-payment-heading">

        <h2 id="success-payment-heading" class="text-lg font-semibold text-slate-900">
            Payment summary
        </h2>

        <!-- Amounts as stored on the order by the server -->

        <dl class="mt-4 space-y-2.5 text-sm">

            <div v-for="row in rows" :key="row.label" class="flex items-center justify-between">
                <dt class="text-slate-600">{{ row.label }}</dt>
                <dd class="font-medium text-slate-900">{{ row.value }}</dd>
            </div>

            <div class="flex items-baseline justify-between border-t border-slate-200 pt-3">
                <dt class="text-base font-semibold text-slate-900">Total</dt>
                <dd class="text-xl font-semibold tracking-tight text-slate-900">{{ formatPrice(order.total, order.currency) }}</dd>
            </div>

        </dl>

        <dl class="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-sm">

            <div v-if="order.paymentMethod" class="flex items-center justify-between gap-4">
                <dt class="text-slate-600">Payment method</dt>
                <dd class="text-right font-medium text-slate-900">{{ paymentMethodLabel(order.paymentMethod) }}</dd>
            </div>

            <div class="flex items-center justify-between gap-4">
                <dt class="text-slate-600">Payment status</dt>
                <dd>
                    <span class="rounded-full px-2.5 py-1 text-xs font-semibold"
                        :class="order.paymentStatus === 'PAID' ? 'bg-brand-soft text-brand' : 'bg-amber-100 text-amber-800'">
                        {{ paymentStatusLabel(order.paymentStatus) }}
                    </span>
                </dd>
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

const rows = computed(() => [
    { label: "Subtotal", value: formatPrice(props.order.subtotal, props.order.currency) },
    // A discount row is only shown for a real (non-zero) discount.
    ...(Number(props.order.discount) > 0
        ? [{ label: "Discount", value: `-${formatPrice(props.order.discount, props.order.currency)}` }]
        : []),
    { label: "Shipping", value: formatPrice(props.order.shipping, props.order.currency) },
    { label: "Tax", value: formatPrice(props.order.tax, props.order.currency) },
]);
</script>
