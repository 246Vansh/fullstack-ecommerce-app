<template>
    <div class="sm:flex sm:items-end sm:justify-between sm:gap-8">

        <div>
            <!-- Section Title -->
            <h2 :id="headingId" class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {{ title }}
            </h2>

            <p v-if="description" class="mt-2 max-w-xl text-base text-slate-600">
                {{ description }}
            </p>
        </div>

        <!-- Desktop Link -->
        <RouterLink v-if="linkText" :to="linkHref" :class="['hidden shrink-0 sm:inline-flex', LINK_CLASSES]">
            {{ linkText }}
            <span aria-hidden="true">
                &rarr;
            </span>
        </RouterLink>

    </div>

    <!-- Mobile Link -->
    <div v-if="linkText" class="mt-4 sm:hidden">
        <RouterLink :to="linkHref" :class="['inline-flex', LINK_CLASSES]">
            {{ linkText }}
            <span aria-hidden="true">
                &rarr;
            </span>
        </RouterLink>
    </div>
</template>

<script setup>
import { RouterLink } from "vue-router";

const LINK_CLASSES = "min-h-11 items-center gap-1 rounded-sm text-sm font-semibold text-brand transition-colors duration-200 hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 outline-brand";

defineProps({
    headingId: {
        type: String,
        default: "",
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: "",
    },
    linkText: {
        type: String,
        default: "",
    },
    linkHref: {
        type: [String, Object],
        default: "/products",
    },
});
</script>
