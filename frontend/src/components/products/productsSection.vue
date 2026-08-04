<template>
    <section class="bg-white">

        <div class="mx-auto max-w-7xl sm:px-6 lg:px-8">

            <!-- Breadcrumb -->

            <Breadcrumb :items="breadcrumbItems" />

            <!-- Header -->

            <ProductsHeader :title="title" :description="description" :total-products="totalProducts" />

            <!-- Toolbar -->

            <div class="mt-8">

                <Toolbar :pagination="pagination" :sort-options="sortOptions" :active-filter-count="activeFilterCount"
                    v-model="selectedSort" />

            </div>

            <!-- Content -->

            <div class="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 lg:grid-cols-4">

                <!-- Sidebar -->

                <FilterSidebar :filters="filters" :filter-data="filterData" v-model="selectedFilters" />

                <!-- Products -->

                <div class="lg:col-span-3 cursor-pointer">

                    <ProductList :products="products" />

                    <Pagination class="mt-12" :total-pages="pagination.totalPages" v-model="pagination.currentPage" />

                </div>

            </div>

        </div>

    </section>
</template>

<script setup>
import Breadcrumb from "./breadcrumb.vue";
import ProductsHeader from "./productsHeader.vue";
import Toolbar from "./toolbar.vue";
import FilterSidebar from "./filterSidebar.vue";
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

});

const selectedSort = defineModel("selectedSort");

const selectedFilters = defineModel("selectedFilters");
</script>