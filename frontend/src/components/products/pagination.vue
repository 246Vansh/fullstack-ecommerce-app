<template>
    <nav class="flex items-center justify-between gap-4 border-t border-slate-200 py-6" aria-label="Pagination">
        <!-- Previous -->

        <button type="button" :disabled="modelValue === 1" @click="changePage(modelValue - 1)" :class="STEP_CLASSES">
            <ChevronLeftIcon class="h-5 w-5" aria-hidden="true" />

            Previous
        </button>

        <!-- Pages (sm and up): first, last, and a window around the current page -->

        <div class="hidden items-center gap-1 sm:flex">

            <template v-for="(page, index) in visiblePages" :key="page ?? `gap-${index}`">

                <span v-if="page === null" class="flex h-11 w-8 items-end justify-center pb-2.5 text-sm text-slate-400"
                    aria-hidden="true">…</span>

                <button v-else type="button" :aria-label="`Page ${page}`"
                    :aria-current="page === modelValue ? 'page' : undefined" @click="changePage(page)" :class="[
                    page === modelValue
                        ? 'bg-brand text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',

                    'inline-flex h-11 min-w-11 items-center justify-center rounded-control px-3 text-sm font-semibold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
                ]">
                    {{ page }}
                </button>

            </template>

        </div>

        <!-- Position (below sm, where the page numbers are hidden) -->

        <p class="text-sm text-slate-600 sm:hidden">
            Page <span class="font-semibold text-slate-900">{{ modelValue }}</span> of {{ totalPages }}
        </p>

        <!-- Next -->

        <button type="button" :disabled="modelValue === totalPages" @click="changePage(modelValue + 1)" :class="STEP_CLASSES">
            Next

            <ChevronRightIcon class="h-5 w-5" aria-hidden="true" />

        </button>

    </nav>
</template>

<script setup>
import { computed } from "vue";

import {
    ChevronLeftIcon,
    ChevronRightIcon,
} from "@heroicons/vue/20/solid";

const STEP_CLASSES = "inline-flex min-h-11 items-center gap-1.5 rounded-control border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer disabled:pointer-events-none disabled:opacity-40";

// Pages within this distance of the current one are listed; the rest collapse to "…".
const WINDOW = 1;

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

// e.g. [1, null, 4, 5, 6, null, 19]; null marks a gap. A gap that would hide
// a single page shows that page instead.
const visiblePages = computed(() => {

    const total = props.totalPages;
    const current = props.modelValue;

    const pages = [];

    for (let page = 1; page <= total; page++) {
        const nearCurrent = Math.abs(page - current) <= WINDOW;
        const edge = page === 1 || page === total;
        const bridgesGap = (page === 2 && current - WINDOW === 3) || (page === total - 1 && current + WINDOW === total - 2);

        if (edge || nearCurrent || bridgesGap) pages.push(page);
        else if (pages[pages.length - 1] !== null) pages.push(null);
    }

    return pages;

});
</script>
