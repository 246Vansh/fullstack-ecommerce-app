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
                    ? "This link points to a category, brand, color or size we don't carry."
                    : search
                        ? `No products match "${search}". Try a different search term.`
                        : "Try adjusting your filters or search criteria.") }}

            </p>

            <button v-if="error && !loading" type="button" @click="$emit('retry')"
                class="mt-4 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                Retry
            </button>

            <RouterLink v-else-if="clearFiltersTo && !invalidFilter && !loading && !error" :to="clearFiltersTo"
                class="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">
                Clear filters
            </RouterLink>

            <RouterLink v-else-if="(invalidFilter || search) && !loading && !error" :to="{ name: 'products' }"
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

    // The current URL without its filters, when any filter is active.
    clearFiltersTo: {
        type: Object,
        default: null,
    },

});


// Retry re-runs the request for the current URL (filters, search, sort, page).
defineEmits(["retry"]);

const hasProducts = computed(() => {

    return props.products.length > 0;

});

</script>