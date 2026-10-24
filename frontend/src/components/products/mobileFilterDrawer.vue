<template>
    <!-- Filters only change the query, so focus always returns to the Filters button. -->
    <TransitionRoot as="template" :show="open" @after-leave="restoreFocusAfterDialog('mobile-filters-button', false)">
        <Dialog class="relative z-40 lg:hidden" @close="$emit('close')">

            <!-- Backdrop -->
            <TransitionChild as="template" enter="transition-opacity ease-linear duration-300" enter-from="opacity-0"
                enter-to="opacity-100" leave="transition-opacity ease-linear duration-300" leave-from="opacity-100"
                leave-to="opacity-0">
                <div class="fixed inset-0 bg-slate-900/30"></div>
            </TransitionChild>

            <!-- Drawer -->
            <div class="fixed inset-0 z-40 flex justify-end">

                <TransitionChild as="template" enter="transition ease-in-out duration-300 transform"
                    enter-from="translate-x-full" enter-to="translate-x-0"
                    leave="transition ease-in-out duration-300 transform" leave-from="translate-x-0"
                    leave-to="translate-x-full">
                    <DialogPanel class="relative flex h-full w-full max-w-sm flex-col bg-white shadow-xl">

                        <!-- Header -->
                        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-3">

                            <DialogTitle class="text-lg font-semibold text-slate-900">
                                Filters
                            </DialogTitle>

                            <button type="button"
                                class="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
                                @click="$emit('close')">
                                <span class="sr-only">Close filters</span>

                                <XMarkIcon class="h-6 w-6" aria-hidden="true" />
                            </button>

                        </div>

                        <!-- Same sidebar as desktop; filters apply as they change -->
                        <div class="flex-1 overflow-y-auto px-5 pt-2">

                            <FilterSidebar :filters="filters" :filter-data="filterData" :heading="false" v-model="model" />

                        </div>

                        <!-- Footer -->
                        <div class="flex items-center gap-3 border-t border-slate-200 px-5 py-4">

                            <!-- Same "clear" link as the results; filters stay live, so the drawer stays open. -->
                            <PrimaryButton v-if="clearFiltersTo" :to="clearFiltersTo" variant="outline" size="lg"
                                class="shrink-0 px-5">
                                Clear all
                            </PrimaryButton>

                            <PrimaryButton tag="button" size="lg" full-width class="flex-1 px-4" @click="$emit('close')">
                                {{ totalProducts === null
                                    ? "Show products"
                                    : `Show ${totalProducts} ${totalProducts === 1 ? "product" : "products"}` }}
                            </PrimaryButton>

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
import PrimaryButton from "@/components/ui/primaryButton.vue";
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

defineEmits([
    "close",
]);
</script>
