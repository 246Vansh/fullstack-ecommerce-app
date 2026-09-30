<template>

    <div class="space-y-5">

        <!-- Stock is shown per selected variant in the purchase section. -->
        <ProductPrice :price="product.price" :original-price="product.originalPrice" />

    </div>

</template>

<script setup>
import ProductPrice from "@/components/ui/productPrice.vue";

defineProps({
    product: {
        type: Object,
        required: true,
    },
});
</script>