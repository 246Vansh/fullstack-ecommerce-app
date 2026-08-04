<template>
    <div class="mt-5 space-y-1">

        <!-- Brand -->
        <p v-if="brand" class="text-sm font-medium uppercase tracking-wide text-gray-500">
            {{ brand }}
        </p>

        <!-- Product Name -->
        <h3 class="text-base font-semibold leading-6 text-gray-900">
            {{ name }}
        </h3>

    </div>
</template>

<script setup>
defineProps({

    brand: {
        type: String,
        default: "",
    },

    name: {
        type: String,
        required: true,
    },

});
</script>