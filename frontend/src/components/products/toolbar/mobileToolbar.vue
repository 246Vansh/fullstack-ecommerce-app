<template>
    <div class="flex items-center justify-between border-b border-gray-200 pb-6 lg:hidden">
        <!-- Filter Button -->
        <MobileFilterButton :active-count="activeFilterCount" @open-filters="$emit('open-filters')" />

        <!-- Sort -->
        <SortDropdown v-model="selectedSort" :options="sortOptions" />
    </div>
</template>

<script setup>
import MobileFilterButton from "./mobileFilterButton.vue";
import SortDropdown from "./sortDropdown.vue";

import { sortOptions } from "@/constants/catalog/sortOptions";

defineProps({

    activeFilterCount: {
        type: Number,
        default: 0,
    },

});

const selectedSort = defineModel({
    type: String,
    default: "newest",
});

defineEmits([
    "open-filters",
]);
</script>