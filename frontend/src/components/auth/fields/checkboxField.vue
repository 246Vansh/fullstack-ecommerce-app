<template>
    <div class="flex items-start">

        <div class="flex h-5 items-center">

            <input :id="id" v-model="model" :name="name" type="checkbox" :disabled="disabled" :required="required"
                class=" h-4 w-4 rounded border-gray-300 text-gray-900 transition-colors focus:ring-2 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-60" />

        </div>

        <div class="ml-3">

            <label :for="id" class="cursor-pointer text-sm font-medium text-gray-900">
                {{ label }}

                <span v-if="required" class="ml-1 text-red-500">
                    *
                </span>

            </label>

            <p v-if="helper && !error" class="mt-1 text-xs text-gray-500">
                {{ helper }}
            </p>

            <p v-if="error" class="mt-1 text-xs font-medium text-red-600">
                {{ error }}
            </p>

        </div>

    </div>
</template>

<script setup>
const model = defineModel({
    type: Boolean,
    default: false,
});

defineProps({

    id: {
        type: String,
        default: "",
    },

    name: {
        type: String,
        default: "",
    },

    label: {
        type: String,
        required: true,
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

    disabled: {
        type: Boolean,
        default: false,
    },

});
</script>