<template>
    <section class="bg-white">

        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

            <!-- Breadcrumb -->

            <Breadcrumb :items="breadcrumbItems" />

            <!-- Header -->

            <ProductsHeader :title="title" :description="description" :total-products="totalProducts" />

            <!-- Toolbar -->

            <div class="mt-8">

                <Toolbar :pagination="pagination" :sort-options="sortOptions" :active-filter-count="activeFilterCount"
                    v-model="selectedSort" @open-filters="filtersOpen = true" />

            </div>

            <!-- Content -->

            <div class="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">

                <!-- Sidebar (desktop) -->

                <FilterSidebar class="hidden lg:block" :filters="filters" :filter-data="filterData" v-model="selectedFilters" />

                <!-- Products -->

                <div class="lg:col-span-3 cursor-pointer">

                    <ProductList :products="products" :loading="loading" :error="error" :invalid-filter="invalidFilter" />

                    <Pagination class="mt-12" :total-pages="pagination.totalPages" v-model="pagination.currentPage" />

                </div>

            </div>

        </div>

        <!-- Filters (mobile) -->

        <MobileFilterDrawer :open="filtersOpen" :filters="filters" :filter-data="filterData"
            :total-products="totalProducts" v-model="selectedFilters" @close="filtersOpen = false" />

    </section>
</template>

<script setup>
import { ref } from "vue";

import Breadcrumb from "./breadcrumb.vue";
import ProductsHeader from "./productsHeader.vue";
import Toolbar from "./toolbar.vue";
import FilterSidebar from "./filterSidebar.vue";
import MobileFilterDrawer from "./mobileFilterDrawer.vue";
import Pagination from "./pagination.vue";
import ProductList from "./productList.vue";

defineProps({

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

    totalProducts: {
        type: Number,
        default: 0,
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

});

const selectedSort = defineModel("selectedSort");

const selectedFilters = defineModel("selectedFilters");

const filtersOpen = ref(false);
</script>