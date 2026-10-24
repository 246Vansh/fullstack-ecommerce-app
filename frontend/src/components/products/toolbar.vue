<template>
    <!-- Below lg the bar sticks under the 4rem header (z-30), so Filters and Sort
         stay in reach while scrolling the grid. -->
    <section aria-label="Products toolbar"
        class="sticky top-16 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">

        <!-- Desktop Toolbar -->
        <DesktopToolbar :pagination="pagination" :sort-options="sortOptions" v-model="selectedSort" />

        <!-- Mobile Toolbar -->
        <MobileToolbar :active-filter-count="activeFilterCount" :sort-options="sortOptions" v-model="selectedSort"
            @open-filters="$emit('open-filters')" />

    </section>
</template>

<script setup>
import DesktopToolbar from "./toolbar/desktopToolbar.vue";
import MobileToolbar from "./toolbar/mobileToolbar.vue";

defineProps({

    pagination: {
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

const selectedSort = defineModel({

    type: String,
    default: "newest",

});

defineEmits([
    "open-filters",
]);
</script>
