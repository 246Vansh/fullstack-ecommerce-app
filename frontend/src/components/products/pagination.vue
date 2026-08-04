<template>
    <nav class="flex items-center justify-between border-t border-gray-200 px-4 py-6 sm:px-0" aria-label="Pagination">
        <!-- Previous -->

        <button type="button" :disabled="modelValue === 1" @click="changePage(modelValue - 1)"
            class="inline-flex items-center border-t-2 border-transparent pt-4 pr-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-40">
            <ChevronLeftIcon class="mr-3 h-5 w-5 text-gray-400" />

            Previous
        </button>

        <!-- Pages -->

        <div class="hidden md:flex">

            <button v-for="page in visiblePages" :key="page" type="button" @click="changePage(page)" :class="[
                page === modelValue
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',

                'inline-flex items-center border-t-2 px-4 pt-4 text-sm font-medium'
            ]">
                {{ page }}
            </button>

        </div>

        <!-- Next -->

        <button type="button" :disabled="modelValue === totalPages" @click="changePage(modelValue + 1)"
            class="inline-flex items-center border-t-2 border-transparent pt-4 pl-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-40">
            Next

            <ChevronRightIcon class="ml-3 h-5 w-5 text-gray-400" />

        </button>

    </nav>
</template>

<script setup>
import { computed } from "vue";

import {
    ChevronLeftIcon,
    ChevronRightIcon,
} from "@heroicons/vue/20/solid";

const props = defineProps({

    modelValue: {
        type: Number,
        default: 1,
    },

    totalPages: {
        type: Number,
        required: true,
    },

});

const emit = defineEmits([
    "update:modelValue",
]);

function changePage(page) {

    if (page < 1 || page > props.totalPages) return;
    emit("update:modelValue", page);

}

const visiblePages = computed(() => {

    const pages = [];
    for (let i = 1; i <= props.totalPages; i++) {
        pages.push(i);
    }
    return pages;

});
</script>