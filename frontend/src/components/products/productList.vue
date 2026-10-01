<template>

    <!-- Empty State -->

    <div v-if="!hasProducts"
        class="flex min-h-100 items-center justify-center rounded-xl border border-dashed border-gray-300">

        <div class="text-center">

            <h3 class="text-lg font-semibold text-gray-900">

                {{ loading ? "Loading products..." : error ? "Could not load products" : invalidFilter ? "Filter not found" : "No products found" }}

            </h3>

            <p v-if="!loading" class="mt-2 text-sm text-gray-500">

                {{ error || (invalidFilter
                    ? "This link points to a category, subcategory or brand we don't carry."
                    : search
                        ? `No products match "${search}". Try a different search term.`
                        : "Try adjusting your filters or search criteria.") }}

            </p>

            <RouterLink v-if="(invalidFilter || search) && !loading && !error" :to="{ name: 'products' }"
                class="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">
                Browse all products
            </RouterLink>

        </div>

    </div>


    <!-- Products -->

    <ProductGrid v-else>

        <ProductCard v-for="product in props.products" :key="product.id" :product="product" />

    </ProductGrid>

</template>


<script setup>

import { computed } from "vue";
import { RouterLink } from "vue-router";
import ProductGrid from "./productGrid.vue";
import ProductCard from "./product/productCard.vue";


const props = defineProps({

    products: {
        type: Array,
        default: () => [],
    },

    loading: {
        type: Boolean,
        default: false,
    },

    error: {
        type: String,
        default: "",
    },

    // A catalog link with an unknown category, subcategory or brand.
    invalidFilter: {
        type: Boolean,
        default: false,
    },

    // The active ?search= term, if any.
    search: {
        type: String,
        default: "",
    },

});


const hasProducts = computed(() => {

    return props.products.length > 0;

});

</script>