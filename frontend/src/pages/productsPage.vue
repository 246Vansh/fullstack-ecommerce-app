<template>
    <Header />

    <main id="main-content" tabindex="-1">
        <ProductsSection :title="pageData.title" :description="pageData.description" :breadcrumb-items="breadcrumbItems" :products="paginatedProducts"
            :total-products="totalProducts" :pagination="paginationInfo" :filters="filters" :filter-data="filterData"
            :active-filter-count="activeFilterCount" v-model:selected-sort="selectedSort"
            v-model:selected-filters="selectedFilters" :sort-options="sortOptions" :loading="loading" :error="error"
            :invalid-filter="invalidLinkFilter" :search="searchQuery" :clear-filters-to="clearFiltersTo" @retry="refetch" />
    </main>

    <Footer />
</template>

<script setup>
import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";

import ProductsSection from "@/components/products/productsSection.vue";

import { computed, ref, watch } from "vue";

import { useProducts } from "@/composables/useProducts";

import { filters, colors, sizes, priceRanges, availability, sortOptions } from "@/constants/catalog";
import { priceRangeLabel } from "@/constants/catalog/priceRanges";

const { selectedSort, selectedFilters, paginationInfo, paginatedProducts, totalProducts, activeFilterCount, categories, brands, loading, error, invalidLinkFilter, searchQuery, clearFiltersTo, refetch } = useProducts();

// useProducts reads the catalog state from the URL and writes it back, so
// links, refresh and Back/Forward all show the same catalog.

const pageData = computed(() => searchQuery.value
    ? {
        title: `Results for "${searchQuery.value}"`,
        description: "Products matching your search.",
    }
    : {
        title: "All Products",
        description: "Discover premium essentials designed for everyday comfort and timeless style.",
    });

// A search keeps "Products" as a link back to the full catalog.
const breadcrumbItems = computed(() => [
    { name: "Home", href: "/" },
    ...(searchQuery.value
        ? [{ name: "Products", href: "/products" }, { name: "Search", current: true }]
        : [{ name: "Products", current: true }]),
]);

// Price options are labelled in the currency of the products on screen: one
// currency gives "$25" / "₹25", several give bare numbers. An empty result
// keeps the last labels instead of switching back and forth.
const priceCurrency = ref(null);

watch(paginatedProducts, (products) => {
    if (!products.length) return;

    const currencies = new Set(products.map((product) => product.currency));
    priceCurrency.value = currencies.size === 1 ? [...currencies][0] : null;
}, { immediate: true });

const labelledPriceRanges = computed(() =>
    priceRanges.map((range) => ({ ...range, label: priceRangeLabel(range, priceCurrency.value) })));

// Categories and brands come from the API; the other options are still constants.
const filterData = computed(() => ({
    categories: categories.value, brands: brands.value, priceRanges: labelledPriceRanges.value, colors, sizes, availability,
}));
</script>