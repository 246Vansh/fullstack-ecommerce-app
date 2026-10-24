<template>
    <baseField :id="id" :label="label" :helper="helper" :error="error" :required="required">

        <div class="relative">

            <baseInput v-model="model" :id="id" :type="showPassword ? 'text' : 'password'" :name="name"
                :placeholder="placeholder" :autocomplete="autocomplete" :required="required" :disabled="disabled"
                :autofocus="autofocus" :error="error" :described-by="describedBy" class="pr-12" />

            <!-- Full input height and 44px wide; the outline is drawn inside the
                 button so the input's edge cannot clip it. -->
            <button type="button" :disabled="disabled" aria-label="Show password"
                :aria-pressed="showPassword" :aria-controls="id"
                class="absolute inset-y-0 right-0 flex min-w-11 cursor-pointer items-center justify-center rounded-r-control px-3 text-slate-500 transition-colors hover:text-slate-800 outline-brand focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                @click="showPassword = !showPassword">

                <EyeIcon v-if="!showPassword" class="h-5 w-5" aria-hidden="true" />

                <EyeSlashIcon v-else class="h-5 w-5" aria-hidden="true" />

            </button>

        </div>

    </baseField>
</template>

<script setup>
import { computed, ref } from "vue";

import {
    EyeIcon,
    EyeSlashIcon,
} from "@heroicons/vue/24/outline";

import baseField from "./baseField.vue";
import baseInput from "./baseInput.vue";

const model = defineModel();

const showPassword = ref(false);

const props = defineProps({

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

// The error replaces the helper while it is shown (see baseField).
const describedBy = computed(() => props.error ? `${props.id}-error` : props.helper ? `${props.id}-helper` : undefined);
</script>