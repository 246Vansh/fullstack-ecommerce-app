<template>

    <section class="grid gap-6 md:grid-cols-3">

        <!-- Download Invoice -->
        <RouterLink to="/invoice"
            class="group flex h-16 cursor-pointer items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white text-slate-900 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg">
            <ArrowDownTrayIcon class="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />

            <span class="text-xl font-semibold">

                Download Invoice

            </span>
        </RouterLink>

        <!-- Track Order -->

        <RouterLink to="/trackOrder"
            class="group flex h-16 items-center justify-center gap-4 rounded-xl bg-green-600 text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-green-700 hover:shadow-xl">

            <TruckIcon class="h-7 w-7 transition-transform duration-300 group-hover:translate-x-1" />

            <span class="text-xl font-semibold">

                Track Order

            </span>

        </RouterLink>

        <!-- Continue Shopping -->

        <RouterLink to="/products"
            class="group flex h-16 items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white text-slate-900 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg">

            <ShoppingBagIcon class="h-7 w-7 transition-transform duration-300 group-hover:scale-110" />

            <span class="text-xl font-semibold">

                Continue Shopping

            </span>

        </RouterLink>

    </section>

</template>

<script setup>
import { RouterLink } from "vue-router";
import {
    ArrowDownTrayIcon,
    TruckIcon,
    ShoppingBagIcon,
} from "@heroicons/vue/24/outline";
</script>