<template>
    <Disclosure as="div" :defaultOpen="filter.defaultOpen" class="border-b border-gray-200 py-6" v-slot="{ open }">
        <!-- Section Header -->

        <h3 class="-my-3 flow-root">

            <DisclosureButton
                class="flex w-full items-center justify-between py-3 text-sm text-gray-400 hover:text-gray-500">
                <span class="font-medium text-gray-900">
                    {{ filter.title }}
                </span>

                <span class="ml-6 flex items-center">

                    <PlusIcon v-if="!open" class="h-5 w-5 cursor-pointer" />

                    <MinusIcon v-else class="h-5 w-5 cursor-pointer" />

                </span>

            </DisclosureButton>

        </h3>

        <!-- Section Content -->

        <DisclosurePanel class="pt-6">

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