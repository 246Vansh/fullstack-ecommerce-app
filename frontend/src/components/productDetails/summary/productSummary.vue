<template>
    <div class="flex flex-col gap-8 lg:pt-2">

        <ProductHeader :product="product" :selected-variant="selectedVariant" />

        <PurchaseSection :product="product" @variant-change="selectedVariant = $event" />

    </div>
</template>

<script setup>
import { ref } from "vue";

import ProductHeader from "./productHeader.vue";
import PurchaseSection from "../purchase/purchaseSection.vue";

defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const selectedVariant = ref(null);
</script>