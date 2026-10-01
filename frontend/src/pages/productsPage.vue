<template>
    <Header />

    <ProductsSection :title="pageData.title" :description="pageData.description" :products="paginatedProducts"
        :total-products="totalProducts" :pagination="paginationInfo" :filters="filters" :filter-data="filterData"
        :active-filter-count="activeFilterCount" v-model:selected-sort="selectedSort"
        v-model:selected-filters="selectedFilters" :sort-options="sortOptions" :loading="loading" :error="error"
        :invalid-filter="invalidLinkFilter" :search="searchQuery" />

    <Footer />
</template>

<script setup>
import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";

import ProductsSection from "@/components/products/productsSection.vue";

import { computed, watch } from "vue";
import { useRoute } from "vue-router";

import { useProducts } from "@/composables/useProducts";

import { filters, brands, colors, sizes, priceRanges, availability, sortOptions } from "@/constants/catalog";

const { selectedSort, selectedFilters, paginationInfo, paginatedProducts, totalProducts, activeFilterCount, categories, loading, error, invalidLinkFilter, searchQuery, applyLinkFilters } = useProducts();

const pageData = computed(() => searchQuery.value
    ? {
        title: `Results for "${searchQuery.value}"`,
        description: "Products matching your search.",
    }
    : {
        title: "All Products",
        description: "Discover premium essentials designed for everyday comfort and timeless style.",
    });

// Same comma-separated format as the API: ?category=women&subcategory=women-tops,women-dresses
const listParam = (value) => [value ?? []].flat().flatMap((item) => String(item).split(",")).filter(Boolean);

// Header, footer and homepage links open the catalog pre-filtered, and the
// header search opens it with ?search=. The page
// is reused between /products links, so the query is watched, not read once.
const route = useRoute();

watch(
    () => route.query,
    (query) => applyLinkFilters({
        category: listParam(query.category),
        subcategory: listParam(query.subcategory),
        brand: listParam(query.brand),
        search: String([query.search].flat()[0] ?? "").trim(),
    }),
    { immediate: true },
);

// Categories come from GET /api/categories; the other options are still constants.
const filterData = computed(() => ({
    categories: categories.value, brands, priceRanges, colors, sizes, availability,
}));
</script>