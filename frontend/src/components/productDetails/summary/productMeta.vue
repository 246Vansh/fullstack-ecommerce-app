<template>

    <div class="space-y-5">

        <!-- Stock is shown per selected variant in the purchase section. -->
        <ProductPrice :price="price" :original-price="originalPrice" />

    </div>

</template>

<script setup>
import { computed } from "vue";

import ProductPrice from "@/components/ui/productPrice.vue";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },

    selectedVariant: {
        type: Object,
        default: null,
    },
});

// Same rule the cart prices with: a variant price overrides the product price.
const price = computed(() => props.selectedVariant?.price ?? props.product.price);

const originalPrice = computed(() => props.selectedVariant?.originalPrice ?? props.product.originalPrice);
</script>
