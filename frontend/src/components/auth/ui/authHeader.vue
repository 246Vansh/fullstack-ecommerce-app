<template>
    <!-- Spacing below comes from the form (space-y-*) plus pb-2, not a margin that
         would compete with it. -->
    <header class="pb-2 text-center">

        <!-- Logo -->

        <authLogo v-if="showLogo" class="mb-5 sm:mb-6" />

        <!-- Title -->

        <h1 class="text-2xl font-semibold tracking-tight text-balance text-slate-900 sm:text-3xl">
            {{ title }}
        </h1>

        <!-- Description -->

        <p v-if="description" class="mt-3 text-sm leading-6 text-pretty text-slate-600 sm:text-base sm:leading-7">
            {{ description }}
        </p>

    </header>
</template>

<script setup>
import authLogo from "../shared/authLogo.vue";

defineProps({

    title: {
        type: String,
        required: true,
    },

    description: {
        type: String,
        default: "",
    },

    showLogo: {
        type: Boolean,
        default: true,
    },

});
</script>