<template>
    <RouterLink to="/products"
        class="group inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-semibold text-brand transition-colors hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">

        <ArrowLeftIcon class="h-4 w-4 transition-transform duration-200 motion-safe:group-hover:-translate-x-0.5" aria-hidden="true" />

        <span>Continue Shopping</span>

    </RouterLink>
</template>

<script setup>
import { ArrowLeftIcon } from "@heroicons/vue/24/outline";
import { RouterLink } from "vue-router";
</script>
