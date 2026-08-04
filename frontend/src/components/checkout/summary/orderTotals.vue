<template>

    <section class="border-t border-b border-gray-100 px-8 py-7">

        <!-- Price Rows -->

        <div class="space-y-4">

            <div class="flex justify-between">

                <span class="text-slate-500">
                    Subtotal
                </span>

                <span class="font-semibold">
                    {{ formatPrice(subtotal) }}
                </span>

            </div>

            <div class="flex justify-between">

                <span class="text-slate-500">
                    Discount
                </span>

                <span class="font-semibold text-emerald-600">
                    -{{ formatPrice(discount) }}
                </span>

            </div>

            <div class="flex justify-between">

                <span class="text-slate-500">
                    Shipping
                </span>

                <span class="font-semibold" :class="shipping === 0
                    ? 'text-emerald-600'
                    : 'text-slate-900'">

                    {{ shipping === 0 ? "FREE" : formatPrice(shipping) }}

                </span>

            </div>

            <div class="flex justify-between">

                <span class="text-slate-500">
                    Estimated Tax
                </span>

                <span class="font-semibold">
                    {{ formatPrice(tax) }}
                </span>

            </div>

        </div>

        <!-- Divider -->

        <div class="my-6 border-t border-dashed border-gray-200"></div>

        <!-- Total -->

        <div class="flex items-center justify-between">

            <h3 class="text-xl font-bold text-slate-900">
                Total
            </h3>

            <span class="text-3xl font-bold text-slate-900">
                {{ formatPrice(total) }}
            </span>

        </div>

        <!-- Savings -->

        <div v-if="discount > 0" class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">

            <div class="flex items-center gap-3">

                <GiftIcon class="h-6 w-6 text-emerald-600" />

                <div>

                    <h4 class="font-semibold text-emerald-700">
                        You saved {{ formatPrice(discount) }}
                    </h4>

                    <p class="mt-1 text-sm text-emerald-600">
                        Great choice! Your discounts have been applied.
                    </p>

                </div>

            </div>

        </div>

        <!-- Delivery -->

        <div class="mt-5 rounded-2xl bg-slate-50 p-5">

            <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Estimated Delivery
            </p>

            <p class="mt-2 text-lg font-semibold text-slate-900">
                Tuesday, June 18
            </p>

            <p class="text-sm text-slate-500">
                Express Shipping
            </p>

        </div>

    </section>

</template>

<script setup>
import { GiftIcon } from "@heroicons/vue/24/outline";

defineProps({

    subtotal: Number,

    discount: Number,

    shipping: Number,

    tax: Number,

    total: Number,

});

function formatPrice(price) {

    return `$${Number(price).toFixed(2)}`;

}
</script>