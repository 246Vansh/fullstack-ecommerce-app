<template>
    <Header />

    <ProductsSection :title="pageData.title" :description="pageData.description" :products="paginatedProducts"
        :total-products="totalProducts" :pagination="paginationInfo" :filters="filters" :filter-data="filterData"
        :active-filter-count="activeFilterCount" v-model:selected-sort="selectedSort"
        v-model:selected-filters="selectedFilters" :sort-options="sortOptions" :loading="loading" :error="error" />

    <Footer />
</template>

<script setup>
import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";

import ProductsSection from "@/components/products/productsSection.vue";

import { computed } from "vue";

import { useProducts } from "@/composables/useProducts";

import { filters, brands, colors, sizes, priceRanges, availability, sortOptions } from "@/constants/catalog";

const pageData = {

    title: "All Products",

    description: "Discover premium essentials designed for everyday comfort and timeless style.",

};

const { selectedSort, selectedFilters, paginationInfo, paginatedProducts, totalProducts, activeFilterCount, categories, loading, error } = useProducts();

// Categories come from GET /api/categories; the other options are still constants.
const filterData = computed(() => ({
    categories: categories.value, brands, priceRanges, colors, sizes, availability,
}));
</script>