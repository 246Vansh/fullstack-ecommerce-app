<template>
    <aside class="hidden lg:block">

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