<template>
    <!-- Buy Now is not implemented yet: Add to Cart and the wishlist toggle are offered. -->
    <div class="flex gap-3">

        <AddToCartButton :disabled="disabled" :loading="loading" @click="$emit('add-to-cart')" />

        <WishlistButton :product-id="productId" :name="productName" />

    </div>
</template>

<script setup>
import AddToCartButton from "./addToCartButton.vue";
import WishlistButton from "@/components/ui/wishlistButton.vue";

defineProps({
    productId: {
        type: Number,
        required: true,
    },

    productName: {
        type: String,
        default: "this product",
    },

    disabled: {
        type: Boolean,
        default: false,
    },

    loading: {
        type: Boolean,
        default: false,
    },
});

defineEmits([
    "add-to-cart",
]);
</script>
