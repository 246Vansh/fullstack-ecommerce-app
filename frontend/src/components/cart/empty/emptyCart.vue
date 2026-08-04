<template>
    <section
        class="flex flex-col items-center justify-center rounded-4xl border border-dashed border-gray-300 bg-white px-8 py-20 text-center">

        <ShoppingCartIcon class="h-20 w-20 text-gray-300" />

        <h2 class="mt-8 text-3xl font-bold text-slate-900">
            Your cart is empty
        </h2>

        <p class="mt-3 max-w-md text-gray-500">

            Looks like you haven't added anything to your cart yet.
            Explore our collection and find something you'll love.

        </p>

        <RouterLink to="/products"
            class="mt-10 rounded-2xl bg-slate-900 px-8 py-4 font-semibold text-white transition hover:bg-slate-800">
            Start Shopping
        </RouterLink>

    </section>
</template>

<script setup>
import { ShoppingCartIcon } from "@heroicons/vue/24/outline";
import { RouterLink } from "vue-router";
</script>