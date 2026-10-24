<template>
    <!-- One removable chip per selected option. Removing a chip changes the same
         filter state the sidebar does, so useProducts updates the URL as usual. -->
    <div v-if="chips.length || clearFiltersTo" class="flex flex-wrap items-center gap-2">

        <h3 class="sr-only">Active filters</h3>

        <button v-for="chip in chips" :key="`${chip.key}-${chip.value}`" type="button"
            class="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1.5 pr-2.5 pl-3.5 text-sm font-medium text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer"
            @click="remove(chip)">
            <span class="sr-only">Remove filter:</span>
            {{ chip.label }}
            <XMarkIcon class="h-4 w-4 text-slate-400" aria-hidden="true" />
        </button>

        <!-- Also clears a custom ?minPrice/?maxPrice link, which has no chip. -->
        <RouterLink v-if="clearFiltersTo" :to="clearFiltersTo"
            class="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold text-brand transition-colors duration-200 hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            Clear all
        </RouterLink>

    </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { XMarkIcon } from "@heroicons/vue/20/solid";

const props = defineProps({

    filterData: {
        type: Object,
        required: true,
    },

    // The current URL without its filters, when any filter is active.
    clearFiltersTo: {
        type: Object,
        default: null,
    },

});

const model = defineModel({
    type: Object,
    required: true,
});

// Option lists per filter key, and the field each list labels its options with.
const sources = computed(() => ({
    category: { list: props.filterData.categories ?? [], field: "name" },
    subcategory: {
        list: (props.filterData.categories ?? []).flatMap((category) => category.subcategories ?? []),
        field: "name",
    },
    brand: { list: props.filterData.brands ?? [], field: "name" },
    color: { list: props.filterData.colors ?? [], field: "name" },
    size: { list: props.filterData.sizes ?? [], field: "name" },
    availability: { list: props.filterData.availability ?? [], field: "name" },
}));

const chips = computed(() => {

    const result = [];

    Object.entries(sources.value).forEach(([key, { list, field }]) => {
        (model.value[key] ?? []).forEach((id) => {
            const option = list.find((item) => item.id === id);
            if (option) result.push({ key, value: id, label: option[field] });
        });
    });

    if (model.value.price) {
        const range = (props.filterData.priceRanges ?? []).find((item) => item.slug === model.value.price);
        if (range) result.push({ key: "price", value: range.slug, label: range.label });
    }

    return result;

});

function remove(chip) {

    if (chip.key === "price") {
        model.value.price = null;
        return;
    }

    model.value[chip.key] = model.value[chip.key].filter((id) => id !== chip.value);

}
</script>
