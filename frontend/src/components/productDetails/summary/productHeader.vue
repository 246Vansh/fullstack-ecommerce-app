<template>

    <div class="flex flex-col gap-3">

        <ProductBadge :badge="product.badge" />

        <ProductTitle :title="product.name" :brand="product.brand" />

        <ReviewSummary jump-to-reviews />

        <ProductMeta class="mt-2" :product="product" :selected-variant="selectedVariant" />

    </div>

</template>

<script setup>
import ProductBadge from "./productBadge.vue";
import ProductTitle from "./productTitle.vue";
import ProductMeta from "./productMeta.vue";
import ReviewSummary from "../reviews/reviewSummary.vue";

defineProps({
    product: {
        type: Object,
        required: true,
    },

    selectedVariant: {
        type: Object,
        default: null,
    },
});
</script>