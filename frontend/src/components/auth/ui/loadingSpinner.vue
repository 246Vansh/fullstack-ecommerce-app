<template>
    <!-- With a label the spinner is announced as a status; without one (inside a
         button that already has text) it is decorative. -->
    <span class="inline-flex" :role="label ? 'status' : undefined">

        <svg class="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            aria-hidden="true">

            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />

            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />

        </svg>

        <span v-if="label" class="sr-only">{{ label }}</span>

    </span>
</template>

<script setup>
defineProps({
    label: {
        type: String,
        default: "",
    },
});
</script>
