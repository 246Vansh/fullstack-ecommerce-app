<template>
    <!-- Only the description the API returns; there is no per-product
         highlights, material or care data yet. -->
    <section class="max-w-3xl">

        <h2 class="text-xl font-semibold tracking-tight text-slate-900">
            About this product
        </h2>

        <p class="mt-4 text-base leading-7 whitespace-pre-line text-slate-600">
            {{ product.description }}
        </p>

    </section>
</template>

<script setup>
defineProps({
    product: {
        type: Object,
        required: true,
    },
});
</script>
