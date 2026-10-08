<template>
    <baseField :id="id" :label="label" :helper="helper" :error="error" :required="required">

        <baseInput v-model="model" :id="id" :type="type" :name="name" :placeholder="placeholder"
            :autocomplete="autocomplete" :required="required" :disabled="disabled" :autofocus="autofocus"
            :error="error" :described-by="describedBy" />

    </baseField>
</template>

<script setup>
import { computed } from "vue";

import baseField from "./baseField.vue";
import baseInput from "./baseInput.vue";

const model = defineModel();

const props = defineProps({

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

// The error replaces the helper while it is shown (see baseField).
const describedBy = computed(() => props.error ? `${props.id}-error` : props.helper ? `${props.id}-helper` : undefined);
</script>