<template>
    <header class="mb-10 text-center">

        <!-- Logo -->

        <authLogo v-if="showLogo" class="mx-auto mb-8" />

        <!-- Title -->

        <h1 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {{ title }}
        </h1>

        <!-- Description -->

        <p v-if="description" class="mt-4 text-base leading-7 text-gray-600">
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