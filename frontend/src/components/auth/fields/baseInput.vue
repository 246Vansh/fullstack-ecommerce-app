<template>
    <input v-model="model" :id="id" :type="type" :name="name" :placeholder="placeholder" :disabled="disabled"
        :required="required" :autocomplete="autocomplete" :autofocus="autofocus" :class="[
            'block w-full rounded-xl border bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-2',

            error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900',

            disabled
                ? 'cursor-not-allowed bg-gray-100 text-gray-500'
                : ''
        ]" />
</template>

<script setup>
const model = defineModel();

defineProps({

    id: String,

    type: {
        type: String,
        default: "text",
    },

    name: String,

    placeholder: String,

    autocomplete: {
        type: String,
        default: "off",
    },

    disabled: Boolean,

    required: Boolean,

    autofocus: Boolean,

    error: String,

});
</script>