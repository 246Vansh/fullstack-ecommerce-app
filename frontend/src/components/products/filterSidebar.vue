<template>
    <aside :aria-labelledby="heading ? 'filters-heading' : undefined">

        <h2 v-if="heading" id="filters-heading" class="sr-only">Filters</h2>

        <form class="divide-y divide-gray-200">

            <FilterSection v-for="filter in sortedFilters" :key="filter.id" :filter="filter"
                :options="filterData[filter.source]" v-model="model[filter.key]" />

        </form>

    </aside>
</template>

<script setup>
import { computed } from "vue";

import FilterSection from "./filters/filterSection.vue";

const props = defineProps({

    filters: {
        type: Array,
        default: () => [],
    },

    filterData: {
        type: Object,
        required: true,
    },

    heading: {
        type: Boolean,
        default: true,
    },

});

const model = defineModel({
    type: Object,
    required: true,
});

const sortedFilters = computed(() =>

    [...props.filters].sort(

        (a, b) => a.order - b.order

    )

);
</script>