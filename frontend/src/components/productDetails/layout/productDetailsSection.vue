<template>
    <section class="mt-10">

        <div class="grid grid-cols-1 gap-10 lg:grid-cols-[12fr_13fr]">

            <ProductGallery :product="product" />

            <ProductSummary :product="product" />

        </div>

    </section>
</template>

<script setup>
import ProductGallery from "../gallery/productGallery.vue";
import ProductSummary from "../summary/productSummary.vue";

defineProps({
    product: {
        type: Object,
        required: true,
    },
});
</script>