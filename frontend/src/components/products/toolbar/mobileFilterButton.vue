<template>
    <button
        type="button"
        @click="$emit('open-filters')"
        class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-50 lg:hidden">
        <FunnelIcon class="h-5 w-5" />

        <span>
            Filters
        </span>

        <span v-if="activeCount > 0"
            class="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white">
            {{ activeCount }}
        </span>
    </button>
</template>

<script setup>
import { FunnelIcon } from "@heroicons/vue/24/outline";

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