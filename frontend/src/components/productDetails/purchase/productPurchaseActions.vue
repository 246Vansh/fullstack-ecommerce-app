<template>
    <div class="flex gap-3">

        <AddToCartButton :disabled="disabled" @click="$emit('add-to-cart')" />

        <BuyNowButton :disabled="disabled" @click="$emit('buy-now')" />

        <WishlistButton :disabled="disabled" :isWishlisted="isWishlisted" @toggle-wishlist="$emit('toggle-wishlist')" />

    </div>
</template>

<script setup>
import AddToCartButton from "./addToCartButton.vue";
import BuyNowButton from "./buyNowButton.vue";
import WishlistButton from "./wishlistButton.vue";

defineProps({
    disabled: {
        type: Boolean,
        default: false,
    },
    isWishlisted: {
        type: Boolean,
        default: false,
    },
});

defineEmits([
    "add-to-cart",
    "buy-now",
    "toggle-wishlist",
]);
</script>