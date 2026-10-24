<template>

    <section class="border-t border-slate-100 px-5 py-4 text-sm sm:px-6">

        <!-- Price Rows (all from the server) -->

        <dl class="space-y-2.5">

            <div class="flex justify-between">
                <dt class="text-slate-600">Subtotal</dt>
                <dd class="font-medium text-slate-900">{{ formatPrice(subtotal, currency) }}</dd>
            </div>

            <!-- Only a real (non-zero) discount from the server is shown. -->
            <div v-if="discount > 0" class="flex justify-between">
                <dt class="text-slate-600">Discount</dt>
                <dd class="font-medium text-brand">-{{ formatPrice(discount, currency) }}</dd>
            </div>

            <div class="flex justify-between">
                <dt class="text-slate-600">Shipping</dt>
                <!-- The server's shipping amount, shown as-is (never relabelled "free"). -->
                <dd class="font-medium text-slate-900">{{ formatPrice(shipping, currency) }}</dd>
            </div>

            <div class="flex justify-between">
                <dt class="text-slate-600">Tax</dt>
                <dd class="font-medium text-slate-900">{{ formatPrice(tax, currency) }}</dd>
            </div>

            <!-- Total -->

            <div class="flex items-baseline justify-between border-t border-slate-200 pt-3">
                <dt class="text-base font-semibold text-slate-900">Total</dt>
                <dd class="text-xl font-semibold tracking-tight text-slate-900">{{ formatPrice(total, currency) }}</dd>
            </div>

        </dl>

        <!-- Savings (a real server discount only) -->

        <p v-if="discount > 0" class="mt-4 rounded-control bg-brand-soft px-4 py-3 text-sm font-medium text-brand">
            You saved {{ formatPrice(discount, currency) }} on this order.
        </p>

    </section>

</template>

<script setup>
import { formatPrice } from "@/utils/money";

defineProps({

    subtotal: Number,

    discount: Number,

    shipping: Number,

    tax: Number,

    total: Number,

    // The checkout's one currency; null when the cart mixes currencies (shown as a dash).
    currency: String,

});

</script>
