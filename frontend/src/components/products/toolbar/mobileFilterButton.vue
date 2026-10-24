<template>
    <button
        id="mobile-filters-button"
        type="button"
        @click="$emit('open-filters')"
        class="inline-flex min-h-11 items-center gap-2 rounded-control border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer lg:hidden">
        <AdjustmentsHorizontalIcon class="h-5 w-5 text-slate-500" aria-hidden="true" />

        <span>
            Filters
        </span>

        <span v-if="activeCount > 0"
            class="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white">
            {{ activeCount }}
            <span class="sr-only">active</span>
        </span>
    </button>
</template>

<script setup>
import { AdjustmentsHorizontalIcon } from "@heroicons/vue/24/outline";

defineProps({

    activeCount: {
        type: Number,
        default: 0,
    },

});

defineEmits([
    "open-filters",
]);
</script>
