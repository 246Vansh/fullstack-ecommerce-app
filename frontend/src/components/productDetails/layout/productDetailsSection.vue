<template>
    <section>

        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[12fr_11fr] lg:gap-14">

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