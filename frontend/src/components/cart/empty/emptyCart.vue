<template>
    <section class="flex flex-col items-center justify-center rounded-panel bg-white px-6 py-16 text-center sm:py-20">

        <span class="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand">
            <ShoppingBagIcon class="h-8 w-8" aria-hidden="true" />
        </span>

        <h1 class="mt-6 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Your cart is empty
        </h1>

        <p class="mt-3 max-w-md text-base text-slate-600">
            Looks like you haven't added anything to your cart yet.
            Explore our collection and find something you'll love.
        </p>

        <PrimaryButton to="/products" size="lg" class="mt-8">
            Start Shopping
        </PrimaryButton>

    </section>
</template>

<script setup>
import { ShoppingBagIcon } from "@heroicons/vue/24/outline";

import PrimaryButton from "@/components/ui/primaryButton.vue";
</script>
