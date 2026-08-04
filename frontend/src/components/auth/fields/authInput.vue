<template>
    <baseField :id="id" :label="label" :helper="helper" :error="error" :required="required">

        <baseInput v-model="model" :id="id" :type="type" :name="name" :placeholder="placeholder"
            :autocomplete="autocomplete" :required="required" :disabled="disabled" :autofocus="autofocus"
            :error="error" />

    </baseField>
</template>

<script setup>
import baseField from "./baseField.vue";
import baseInput from "./baseInput.vue";

const model = defineModel();

defineProps({

    id: String,

    label: String,

    name: String,

    type: {
        type: String,
        default: "text",
    },

    placeholder: String,

    autocomplete: {
        type: String,
        default: "off",
    },

    helper: String,

    error: String,

    required: Boolean,

    disabled: Boolean,

    autofocus: Boolean,

});
</script>