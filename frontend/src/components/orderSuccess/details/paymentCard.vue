<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">

            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100">

                <CreditCardIcon class="h-5 w-5 text-violet-600" />

            </div>

            <div>

                <h2 class="text-xl font-bold text-slate-900">

                    Payment Summary

                </h2>

                <p class="text-xs text-slate-500">

                    Amounts calculated by our servers

                </p>

            </div>

        </div>

        <!-- Content -->

        <div class="space-y-4 px-6 py-5">

            <div v-for="row in rows" :key="row.label" class="flex items-center justify-between">

                <span class="text-sm font-semibold text-slate-900">

                    {{ row.label }}

                </span>

                <span class="text-sm font-medium text-slate-700">

                    {{ row.value }}

                </span>

            </div>

            <div class="flex items-center justify-between border-t border-gray-100 pt-3">

                <span class="text-sm font-bold text-slate-900">

                    Total

                </span>

                <span class="text-base font-bold text-orange-600">

                    {{ formatPrice(order.total, order.currency) }}

                </span>

            </div>

            <div class="flex items-center justify-between">

                <span class="text-sm font-semibold text-slate-900">

                    Payment Status

                </span>

                <span class="rounded-full px-3 py-1 text-xs font-semibold"
                    :class="order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">

                    {{ paymentStatusLabel(order.paymentStatus) }}

                </span>

            </div>

            <div v-if="order.paymentMethod" class="flex items-center justify-between">

                <span class="text-sm font-semibold text-slate-900">

                    Payment Method

                </span>

                <span class="text-sm text-slate-700">

                    {{ paymentMethodLabel(order.paymentMethod) }}

                </span>

            </div>

        </div>

    </section>

</template>

<script setup>
import { computed } from "vue";
import { CreditCardIcon } from "@heroicons/vue/24/outline";

import { formatPrice, paymentMethodLabel, paymentStatusLabel } from "@/composables/useOrderSuccess";

const props = defineProps({
    order: {
        type: Object,
        required: true,
    },
});

const rows = computed(() => [
    { label: "Subtotal", value: formatPrice(props.order.subtotal, props.order.currency) },
    { label: "Shipping", value: formatPrice(props.order.shipping, props.order.currency) },
    { label: "Tax", value: formatPrice(props.order.tax, props.order.currency) },
    // A discount row is only shown for a real (non-zero) discount.
    ...(Number(props.order.discount) > 0
        ? [{ label: "Discount", value: `-${formatPrice(props.order.discount, props.order.currency)}` }]
        : []),
]);
</script>