<template>
    <div class="relative z-50 hidden items-center justify-between overflow-visible pb-6 lg:flex">

        <!-- Product Count -->

        <ProductCount :start="pagination.start" :end="pagination.end" :total="pagination.totalItems" />

        <!-- Right Actions -->

        <div class="flex items-center gap-6">

            <SortDropdown v-model="selectedSort" :options="sortOptions" />

        </div>

    </div>
</template>

<script setup>
import ProductCount from "./productCount.vue";
import SortDropdown from "./sortDropdown.vue";

defineProps({

    pagination: {
        type: Object,
        required: true,
    },

    sortOptions: {
        type: Array,
        default: () => [],
    },

});

const selectedSort = defineModel({

    type: String,

    default: "newest",

});
</script>