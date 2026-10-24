<template>
    <Disclosure as="div" :defaultOpen="filter.defaultOpen" class="border-b border-slate-200 py-5" v-slot="{ open }">
        <!-- Section Header -->

        <h3 class="-my-3 flow-root">

            <DisclosureButton
                class="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-sm py-3 text-sm text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <span class="font-semibold text-slate-900">
                    {{ filter.title }}
                </span>

                <span class="ml-6 flex items-center">

                    <PlusIcon v-if="!open" class="h-5 w-5" aria-hidden="true" />

                    <MinusIcon v-else class="h-5 w-5" aria-hidden="true" />

                </span>

            </DisclosureButton>

        </h3>

        <!-- Section Content -->

        <DisclosurePanel class="pt-4">

            <component :is="currentFilterComponent" :options="options" v-model="model" />

        </DisclosurePanel>

    </Disclosure>
</template>

<script setup>
import { computed } from "vue";

import {
    Disclosure,
    DisclosureButton,
    DisclosurePanel,
} from "@headlessui/vue";

import {
    MinusIcon,
    PlusIcon,
} from "@heroicons/vue/24/outline";

import CategoryFilter from "./categoryFilter.vue";
import BrandFilter from "./brandFilter.vue";
import PriceFilter from "./priceFilter.vue";
import ColorFilter from "./colorFilter.vue";
import SizeFilter from "./sizeFilter.vue";
import AvailabilityFilter from "./availabilityFilter.vue";

const props = defineProps({

    filter: {
        type: Object,
        required: true,
    },

    options: {
        type: Array,
        default: () => [],
    },

});

const model = defineModel();

const filterComponents = {

    category: CategoryFilter,

    brand: BrandFilter,

    price: PriceFilter,

    color: ColorFilter,

    size: SizeFilter,

    availability: AvailabilityFilter,

};

const currentFilterComponent = computed(() => {

    return filterComponents[props.filter.key];

});
</script>