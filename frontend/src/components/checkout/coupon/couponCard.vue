<template>

    <checkoutSection number="05" title="Discount Coupon" subtitle="Apply a promo code to save on your purchase."
        :icon="TicketIcon">

        <div class="flex gap-4">

            <input type="text" placeholder="Enter coupon code"
                class="h-14 flex-1 rounded-2xl border border-gray-200 px-5 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />

            <button
                class="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-500 px-8 font-semibold text-white transition hover:shadow-lg hover:shadow-indigo-200 cursor-pointer">
                Apply
            </button>

        </div>

        <!-- Example -->

        <div
            class="mt-5 flex items-center justify-between rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 px-5 py-4 cursor-pointer">

            <div>

                <h3 class="font-semibold text-emerald-700">
                    SAVE20
                </h3>

                <p class="mt-1 text-sm text-emerald-600">
                    Save 20% on orders above $100
                </p>

            </div>

            <button class="font-semibold text-indigo-600 cursor-pointer">
                Use
            </button>

        </div>

    </checkoutSection>

</template>

<script setup>
import { TicketIcon } from "@heroicons/vue/24/outline";
import checkoutSection from "../common/checkoutSection.vue";
</script>