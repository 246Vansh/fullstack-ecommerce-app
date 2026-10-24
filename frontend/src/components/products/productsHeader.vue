<template>
    <section class="pt-5 sm:pt-6" aria-labelledby="products-heading">

        <h1 id="products-heading" class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {{ title }}
        </h1>

        <p v-if="description" class="mt-3 max-w-2xl text-base text-slate-600">
            {{ description }}
        </p>

        <!-- Below lg only: the desktop toolbar shows "Showing 1–12 of N" instead.
             No count while it is unknown (first load, or the request failed). -->
        <p v-if="totalProducts !== null" class="mt-4 text-sm text-slate-500 lg:hidden">
            <span class="font-semibold text-slate-900">{{ totalProducts }}</span>
            {{ totalProducts === 1 ? "product" : "products" }}
        </p>

    </section>
</template>

<script setup>

defineProps({

    title: {
        type: String,
        required: true,
    },

    description: {
        type: String,
        default: "",
    },

    // null when the count is unknown.
    totalProducts: {
        type: Number,
        default: null,
    },

});
</script>
