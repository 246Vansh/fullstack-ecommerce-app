<template>
    <div class="space-y-2">

        <!-- Label -->

        <label v-if="label" :for="id" class="block text-sm font-medium text-gray-900">
            {{ label }}

            <span v-if="required" class="ml-1 text-red-500">
                *
            </span>

        </label>

        <!-- Input -->

        <slot />

        <!-- Helper -->

        <p v-if="helper && !error" class="text-xs text-gray-500">
            {{ helper }}
        </p>

        <!-- Error -->

        <p v-if="error" class="text-xs font-medium text-red-600">
            {{ error }}
        </p>

    </div>
</template>

<script setup>
defineProps({

    id: {
        type: String,
        default: "",
    },

    label: {
        type: String,
        default: "",
    },

    helper: {
        type: String,
        default: "",
    },

    error: {
        type: String,
        default: "",
    },

    required: {
        type: Boolean,
        default: false,
    },

});
</script>