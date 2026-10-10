<template>
    <!-- Nothing to show (none found or the request failed): no empty heading. -->
    <section v-if="products.length" class="space-y-8">

        <div>

            <h2 class="text-2xl font-bold text-gray-900">
                Related Products
            </h2>

            <p class="mt-2 text-gray-600">
                You may also like these products.
            </p>

        </div>

        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

            <ProductCard v-for="product in products" :key="product.id" :product="product" :image-sizes="IMAGE_SIZES" />

        </div>

    </section>
</template>

<script setup>
import ProductCard from "@/components/products/product/productCard.vue";

// Card slots in the max-w-7xl page: one column below sm, two from sm, four
// from lg (286px once the page is capped), times the 1.875 a 3:2 photo
// paints at under object-cover in the 4:5 card.
const IMAGE_SIZES = "(min-width: 1280px) 536px, (min-width: 1024px) calc(47vw - 64px), (min-width: 640px) calc(94vw - 68px), calc(188vw - 60px)";

defineProps({
    products: {
        type: Array,
        default: () => [],
    },
});
</script>