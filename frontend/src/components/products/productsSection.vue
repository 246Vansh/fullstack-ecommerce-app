<template>
    <section class="bg-white">

        <!-- Page intro on the warm surface, like the homepage bands -->

        <div class="border-b border-slate-200/70 bg-surface">

            <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">

                <Breadcrumb :items="breadcrumbItems" />

                <ProductsHeader :title="title" :description="description" :total-products="totalProducts" />

            </div>

        </div>

        <div class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">

            <!-- Toolbar (sticks under the header on mobile and tablet) -->

            <Toolbar :pagination="pagination" :sort-options="sortOptions" :active-filter-count="activeFilterCount"
                v-model="selectedSort" @open-filters="filtersOpen = true" />

            <!-- Content -->

            <div class="mt-6 grid grid-cols-1 gap-x-10 gap-y-8 lg:mt-8 lg:grid-cols-4">

                <!-- Sidebar (desktop) -->

                <FilterSidebar class="hidden lg:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-2"
                    :filters="filters" :filter-data="filterData" v-model="selectedFilters" />

                <!-- Products -->

                <div class="lg:col-span-3">

                    <h2 ref="resultsHeading" tabindex="-1" class="sr-only">Product results</h2>

                    <!-- Announces the result count once a filter, sort or page change has loaded. -->
                    <p role="status" class="sr-only">{{ resultStatus }}</p>

                    <ActiveFilters v-if="activeFilterCount > 0" class="mb-6" :filter-data="filterData"
                        :clear-filters-to="clearFiltersTo" v-model="selectedFilters" />

                    <ProductList :products="products" :loading="loading" :error="error" :invalid-filter="invalidFilter" :search="search"
                        :clear-filters-to="activeFilterCount > 0 ? clearFiltersTo : null" @retry="retry" />

                    <Pagination v-if="!error && products.length && pagination.totalPages > 1" class="mt-12"
                        :total-pages="pagination.totalPages" v-model="pagination.currentPage" />

                </div>

            </div>

        </div>

        <!-- Filters (mobile) -->

        <MobileFilterDrawer :open="filtersOpen" :filters="filters" :filter-data="filterData"
            :total-products="totalProducts" :clear-filters-to="activeFilterCount > 0 ? clearFiltersTo : null"
            v-model="selectedFilters" @close="filtersOpen = false" />

    </section>
</template>

<script setup>
import { ref, watch } from "vue";

import Breadcrumb from "./breadcrumb.vue";
import ProductsHeader from "./productsHeader.vue";
import Toolbar from "./toolbar.vue";
import FilterSidebar from "./filterSidebar.vue";
import MobileFilterDrawer from "./mobileFilterDrawer.vue";
import Pagination from "./pagination.vue";
import ProductList from "./productList.vue";
import ActiveFilters from "./activeFilters.vue";

const props = defineProps({

    title: {
        type: String,
        required: true,
    },

    description: {
        type: String,
        default: "",
    },

    breadcrumbItems: {
        type: Array,
        default: () => [],
    },

    // null when the count is unknown (first load, or the request failed).
    totalProducts: {
        type: Number,
        default: null,
    },

    pagination: {
        type: Object,
        required: true,
    },

    products: {
        type: Array,
        default: () => [],
    },

    filters: {
        type: Array,
        default: () => [],
    },

    filterData: {
        type: Object,
        required: true,
    },

    activeFilterCount: {
        type: Number,
        default: 0,
    },

    sortOptions: {
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

    invalidFilter: {
        type: Boolean,
        default: false,
    },

    search: {
        type: String,
        default: "",
    },

    clearFiltersTo: {
        type: Object,
        default: null,
    },

});

const emit = defineEmits(["retry"]);

const selectedSort = defineModel("selectedSort");

const selectedFilters = defineModel("selectedFilters");

const filtersOpen = ref(false);

const resultsHeading = ref(null);

// The Retry button disappears while loading, so focus moves to the results
// heading instead of falling back to the page; the status line announces the outcome.
function retry() {
    resultsHeading.value?.focus();
    emit("retry");
}

// Updated only when a load settles, so each change is announced once.
const resultStatus = ref("");

watch(() => [props.loading, props.error, props.totalProducts], () => {
    if (props.loading) return;

    resultStatus.value = props.error
        ? "Could not load products"
        : `${props.totalProducts} ${props.totalProducts === 1 ? "product" : "products"} found`;
}, { immediate: true });
</script>
