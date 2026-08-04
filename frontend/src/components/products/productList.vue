<template>
    <!-- Empty State -->

    <div v-if="!hasProducts"
        class="flex min-h-100 items-center justify-center rounded-xl border border-dashed border-gray-300">
        <div class="text-center">

            <h3 class="text-lg font-semibold text-gray-900">
                No products found
            </h3>

            <p class="mt-2 text-sm text-gray-500">
                Try adjusting your filters or search criteria.
            </p>

        </div>
    </div>

    <!-- Products -->

    <ProductGrid v-else>
        <ProductCard v-for="product in props.products" :key="product.id" :product="product"
            @toggle-wishlist="$emit('toggle-wishlist', $event)" />
    </ProductGrid>
</template>

<script setup>
import { computed } from "vue";

import ProductGrid from "./productGrid.vue";
import ProductCard from "./product/productCard.vue";

const props = defineProps({

    products: {
        type: Array,
        default: () => [],
    },

});

defineEmits([
    "toggle-wishlist",
]);

const hasProducts = computed(() => props.products.length > 0);
</script>