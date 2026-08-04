<template>
    <baseField :id="id" :label="label" :helper="helper" :error="error" :required="required">

        <div class="relative">

            <baseInput v-model="model" :id="id" :type="showPassword ? 'text' : 'password'" :name="name"
                :placeholder="placeholder" :autocomplete="autocomplete" :required="required" :disabled="disabled"
                :autofocus="autofocus" :error="error" class="pr-12" />

            <button type="button" :disabled="disabled"
                class="absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 transition-colors hover:text-gray-700"
                @click="showPassword = !showPassword">

                <EyeIcon v-if="!showPassword" class="h-5 w-5" />

                <EyeSlashIcon v-else class="h-5 w-5" />

            </button>

        </div>

    </baseField>
</template>

<script setup>
import { ref } from "vue";

import {
    EyeIcon,
    EyeSlashIcon,
} from "@heroicons/vue/24/outline";

import baseField from "./baseField.vue";
import baseInput from "./baseInput.vue";

const model = defineModel();

const showPassword = ref(false);

defineProps({

    id: String,

    label: String,

    name: String,

    placeholder: String,

    autocomplete: {
        type: String,
        default: "current-password",
    },

    helper: String,

    error: String,

    required: Boolean,

    disabled: Boolean,

    autofocus: Boolean,

});
</script>