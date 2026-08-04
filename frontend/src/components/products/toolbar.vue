<template>
    <section aria-label="Products toolbar">

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