<template>
    <div class="flex items-center justify-between gap-3 py-3 lg:hidden">
        <!-- Filter Button -->
        <MobileFilterButton :active-count="activeFilterCount" @open-filters="$emit('open-filters')" />

        <!-- Sort -->
        <SortDropdown v-model="selectedSort" :options="sortOptions" />
    </div>
</template>

<script setup>
import MobileFilterButton from "./mobileFilterButton.vue";
import SortDropdown from "./sortDropdown.vue";

defineProps({

    activeFilterCount: {
        type: Number,
        default: 0,
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

defineEmits([
    "open-filters",
]);
</script>
