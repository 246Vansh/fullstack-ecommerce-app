<template>
    <input v-model="model" :id="id" :type="type" :name="name" :placeholder="placeholder" :disabled="disabled"
        :required="required" :autocomplete="autocomplete" :autofocus="autofocus"
        :aria-invalid="error ? 'true' : undefined" :aria-describedby="describedBy || undefined" :class="[
            // 16px text below sm: iOS zooms the page into any smaller input.
            'block min-h-11 w-full rounded-control border px-4 py-2.5 text-base text-slate-900 placeholder:text-slate-500 transition-colors duration-150 focus:outline-none focus:ring-3 sm:text-sm',

            error
                ? 'border-red-600 focus:border-red-600 focus:ring-red-600/20'
                : 'border-slate-300 hover:border-slate-400 focus:border-brand focus:ring-brand/20',

            // bg-white only when enabled, so it never competes with the disabled background.
            disabled
                ? 'cursor-not-allowed bg-slate-100 text-slate-500'
                : 'bg-white'
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
    // Id of the helper or error text shown under the field.
    describedBy: String,
});
</script>
