<template>

    <!-- Invoice download and order tracking are not implemented yet, so they are not offered. -->
    <section class="flex flex-col items-center justify-center gap-4 sm:flex-row">

        <!-- This order -->

        <RouterLink :to="{ name: 'order-details', params: { id: orderId } }"
            class="group flex h-16 w-full max-w-md items-center justify-center gap-4 rounded-xl bg-green-600 text-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-green-700 hover:shadow-lg">

            <DocumentTextIcon class="h-7 w-7" />

            <span class="text-xl font-semibold">
                View Order
            </span>

        </RouterLink>

        <!-- Order history -->

        <RouterLink :to="{ name: 'orders' }"
            class="group flex h-16 w-full max-w-md items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white text-slate-900 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg">

            <ClipboardDocumentListIcon class="h-7 w-7" />

            <span class="text-xl font-semibold">
                My Orders
            </span>

        </RouterLink>

        <!-- Continue Shopping -->

        <RouterLink to="/products"
            class="group flex h-16 w-full max-w-md items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white text-slate-900 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg">

            <ShoppingBagIcon class="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />

            <span class="text-xl font-semibold">
                Continue Shopping
            </span>

        </RouterLink>

    </section>

</template>

<script setup>
import { RouterLink } from "vue-router";
import { ClipboardDocumentListIcon, DocumentTextIcon, ShoppingBagIcon } from "@heroicons/vue/24/outline";

defineProps({
    orderId: {
        type: Number,
        required: true,
    },
});
</script>
