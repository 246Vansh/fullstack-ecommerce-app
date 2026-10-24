<template>
    <section
        class="flex flex-col items-center justify-center rounded-4xl border border-dashed border-gray-300 bg-white px-8 py-20 text-center">

        <ShoppingCartIcon class="h-20 w-20 text-gray-300" />

        <h1 class="mt-8 text-3xl font-bold text-slate-900">
            Your cart is empty
        </h1>

        <p class="mt-3 max-w-md text-gray-500">

            Looks like you haven't added anything to your cart yet.
            Explore our collection and find something you'll love.

        </p>

        <PrimaryButton to="/products" size="lg" class="mt-10">
            Start Shopping
        </PrimaryButton>

    </section>
</template>

<script setup>
import { ShoppingCartIcon } from "@heroicons/vue/24/outline";

import PrimaryButton from "@/components/ui/primaryButton.vue";
</script>