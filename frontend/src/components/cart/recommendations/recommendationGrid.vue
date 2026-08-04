<template>
    <div class="mt-6 overflow-x-auto scrollbar-hide">

        <div class="flex gap-5 min-w-max pb-2">

            <productCard v-for="product in products" :key="product.id" :product="product" class="w-[490px] shrink-0"
                @add-to-cart="$emit('addToCart', $event)" @toggle-wishlist="$emit('toggleWishlist', $event)" />

        </div>

    </div>
</template>

<script setup>
import productCard from "@/components/products/product/productCard.vue";

defineProps({
    products: {
        type: Array,
        default: () => [],
    },
});

defineEmits([
    "addToCart",
    "toggleWishlist",
]);
</script>