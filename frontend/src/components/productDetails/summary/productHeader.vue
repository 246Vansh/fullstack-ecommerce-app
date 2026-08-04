<template>

    <div class="flex flex-col gap-2">

        <ProductBadge :badge="product.badge" />

        <ProductTitle :title="product.name" :brand="product.brand" />

        <ProductMeta :product="product" />

    </div>

</template>

<script setup>
import ProductBadge from "./productBadge.vue";
import ProductTitle from "./productTitle.vue";
import ProductMeta from "./productMeta.vue";

defineProps({
    product: {
        type: Object,
        required: true,
    },
});
</script>