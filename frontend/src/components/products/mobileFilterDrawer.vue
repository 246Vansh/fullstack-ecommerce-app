<template>
    <!-- Filters only change the query, so focus always returns to the Filters button. -->
    <TransitionRoot as="template" :show="open" @after-leave="restoreFocusAfterDialog('mobile-filters-button', false)">
        <Dialog class="relative z-40 lg:hidden" @close="$emit('close')">

            <!-- Backdrop -->
            <TransitionChild as="template" enter="transition-opacity ease-linear duration-300" enter-from="opacity-0"
                enter-to="opacity-100" leave="transition-opacity ease-linear duration-300" leave-from="opacity-100"
                leave-to="opacity-0">
                <div class="fixed inset-0 bg-black/25"></div>
            </TransitionChild>

            <!-- Drawer -->
            <div class="fixed inset-0 z-40 flex justify-end">

                <TransitionChild as="template" enter="transition ease-in-out duration-300 transform"
                    enter-from="translate-x-full" enter-to="translate-x-0"
                    leave="transition ease-in-out duration-300 transform" leave-from="translate-x-0"
                    leave-to="translate-x-full">
                    <DialogPanel class="relative flex h-full w-full max-w-xs flex-col bg-white shadow-xl">

                        <!-- Header -->
                        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-4">

                            <DialogTitle class="text-lg font-semibold text-gray-900">
                                Filters
                            </DialogTitle>

                            <button type="button" class="rounded-md p-2 text-gray-400 hover:text-gray-500 cursor-pointer"
                                @click="$emit('close')">
                                <span class="sr-only">Close filters</span>

                                <XMarkIcon class="h-6 w-6" />
                            </button>

                        </div>

                        <!-- Same sidebar as desktop; filters apply as they change -->
                        <div class="flex-1 overflow-y-auto px-4">

                            <FilterSidebar :filters="filters" :filter-data="filterData" :heading="false" v-model="model" />

                        </div>

                        <!-- Footer -->
                        <div class="border-t border-gray-200 p-4">

                            <button type="button"
                                class="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                                @click="$emit('close')">
                                {{ totalProducts === null
                                    ? "Show products"
                                    : `Show ${totalProducts} ${totalProducts === 1 ? "product" : "products"}` }}
                            </button>

                        </div>

                    </DialogPanel>
                </TransitionChild>

            </div>

        </Dialog>
    </TransitionRoot>
</template>

<script setup>
import {
    Dialog,
    DialogPanel,
    DialogTitle,
    TransitionChild,
    TransitionRoot,
} from "@headlessui/vue";

import { XMarkIcon } from "@heroicons/vue/24/outline";

import FilterSidebar from "./filterSidebar.vue";
import { restoreFocusAfterDialog } from "@/router/pageFocus";

defineProps({

    open: {
        type: Boolean,
        default: false,
    },

    filters: {
        type: Array,
        default: () => [],
    },

    filterData: {
        type: Object,
        required: true,
    },

    totalProducts: {
        type: Number,
        default: 0,
    },

});

const model = defineModel({
    type: Object,
    required: true,
});

defineEmits([
    "close",
]);
</script>
