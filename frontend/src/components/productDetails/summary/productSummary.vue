<template>
    <div class="flex flex-col gap-6 lg:pl-6">

        <ProductHeader :product="product" />

        <PurchaseSection :product="product" />

    </div>
</template>

<script setup>
import ProductHeader from "./productHeader.vue";
import PurchaseSection from "../purchase/purchaseSection.vue";

defineProps({
    product: {
        type: Object,
        required: true,
    },
});
</script>