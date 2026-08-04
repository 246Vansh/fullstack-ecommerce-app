<template>
    <div class="text-center">

        <p class="text-sm text-gray-600">

            {{ text }}

            <RouterLink :to="to"
                class="ml-1 font-semibold text-gray-900 transition-colors duration-200 hover:text-gray-700">
                {{ linkText }}
            </RouterLink>

        </p>

    </div>
</template>

<script setup>
import { RouterLink } from "vue-router";

defineProps({

    text: {
        type: String,
        required: true,
    },

    linkText: {
        type: String,
        required: true,
    },

    to: {
        type: String,
        required: true,
    },

});
</script>