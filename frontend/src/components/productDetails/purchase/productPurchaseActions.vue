<template>
    <!-- Buy Now and wishlist are not implemented yet, so only Add to Cart is offered. -->
    <div class="flex gap-3">

        <AddToCartButton :disabled="disabled" @click="$emit('add-to-cart')" />

    </div>
</template>

<script setup>
import AddToCartButton from "./addToCartButton.vue";

defineProps({
    disabled: {
        type: Boolean,
        default: false,
    },
});

defineEmits([
    "add-to-cart",
]);
</script>
