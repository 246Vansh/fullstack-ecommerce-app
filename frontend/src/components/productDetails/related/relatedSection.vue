<template>
    <section class="space-y-8">

        <div>

            <h2 class="text-2xl font-bold text-gray-900">
                Related Products
            </h2>

            <p class="mt-2 text-gray-600">
                You may also like these products.
            </p>

        </div>

        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

            <ProductCard v-for="product in products" :key="product.id" :product="product" />

        </div>

    </section>
</template>

<script setup>
import ProductCard from "@/components/products/product/productCard.vue";

defineProps({
    products: {
        type: Array,
        default: () => [],
    },
});
</script>