<template>

    <RouterLink :to="to" class="text-sm font-medium text-gray-900 transition-colors duration-200 hover:text-gray-700">
        <slot />
    </RouterLink>

</template>

<script setup>
import { RouterLink } from "vue-router";

defineProps({

    to: {
        type: String,
        required: true,
    },

});
</script>