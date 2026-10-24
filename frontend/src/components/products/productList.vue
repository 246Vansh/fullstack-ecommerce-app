<template>

    <!-- First load: card-shaped placeholders, so the page does not jump when results arrive.
         The status line in productsSection announces the outcome. -->

    <div v-if="!hasProducts && loading">
        <span class="sr-only">Loading products...</span>
        <ProductGrid>
            <ProductCardSkeleton v-for="n in 6" :key="n" />
        </ProductGrid>
    </div>

    <!-- Empty / Error State -->

    <div v-else-if="!hasProducts"
        class="flex min-h-96 items-center justify-center rounded-panel bg-surface px-6 py-16">

        <div class="flex max-w-sm flex-col items-center text-center">

            <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-card">
                <ExclamationTriangleIcon v-if="error" class="h-6 w-6" aria-hidden="true" />
                <MagnifyingGlassIcon v-else class="h-6 w-6" aria-hidden="true" />
            </span>

            <h3 class="mt-5 text-lg font-semibold text-slate-900">

                {{ error ? "Could not load products" : invalidFilter ? "Filter not found" : "No products found" }}

            </h3>

            <p class="mt-2 text-sm text-slate-600">

                {{ error || (invalidFilter
                    ? "This link points to a category, brand, color or size we don't carry."
                    : search
                        ? `No products match "${search}". Try a different search term.`
                        : "Try adjusting your filters or search criteria.") }}

            </p>

            <PrimaryButton v-if="error" tag="button" class="mt-6" @click="$emit('retry')">
                Retry
            </PrimaryButton>

            <PrimaryButton v-else-if="clearFiltersTo && !invalidFilter" :to="clearFiltersTo" class="mt-6">
                Clear filters
            </PrimaryButton>

            <PrimaryButton v-else-if="invalidFilter || search" :to="{ name: 'products' }" class="mt-6">
                Browse all products
            </PrimaryButton>

        </div>

    </div>


    <!-- Products (dimmed while the next page, sort or filter loads) -->

    <ProductGrid v-else :aria-busy="loading || undefined"
        :class="['transition-opacity duration-200', loading ? 'pointer-events-none opacity-50' : '']">

        <ProductCard v-for="product in props.products" :key="product.id" :product="product" :image-sizes="IMAGE_SIZES" />

    </ProductGrid>

</template>


<script setup>

import { computed } from "vue";
import { ExclamationTriangleIcon, MagnifyingGlassIcon } from "@heroicons/vue/24/outline";

import ProductGrid from "./productGrid.vue";
import ProductCard from "./product/productCard.vue";
import ProductCardSkeleton from "./product/productCardSkeleton.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";

// Grid slots: two columns below sm, three from sm (beside the sidebar from lg,
// ~285px once max-w-7xl caps the page), times the 1.875 a 3:2 photo paints at
// under object-cover in the 4:5 card.
const IMAGE_SIZES = "(min-width: 1280px) 534px, (min-width: 1024px) 41vw, (min-width: 640px) calc(62vw - 60px), calc(94vw - 45px)";


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
