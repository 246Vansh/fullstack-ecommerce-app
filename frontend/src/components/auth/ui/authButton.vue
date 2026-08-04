<template>
    <button :type="type" :disabled="disabled || loading" :class="[
        'inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2',

        disabled || loading
            ? 'cursor-not-allowed bg-gray-300 text-white'
            : 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-900'
    ]">

        <loadingSpinner v-if="loading" class="mr-2" />

        <slot />

    </button>
</template>

<script setup>
import loadingSpinner from "./loadingSpinner.vue";

defineProps({

    type: {
        type: String,
        default: "button",
    },

    disabled: {
        type: Boolean,
        default: false,
    },

    loading: {
        type: Boolean,
        default: false,
    },

});
</script>