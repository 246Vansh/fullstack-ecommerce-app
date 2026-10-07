<template>
    <div class="mt-12 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
        <FavoriteCard v-for="product in products" :key="product.id" :product="product" />
    </div>
</template>

<script setup>
import FavoriteCard from "./favoriteCard.vue";

defineProps({
    products: {
        type: Array,
        required: true,
    },
});
</script>
