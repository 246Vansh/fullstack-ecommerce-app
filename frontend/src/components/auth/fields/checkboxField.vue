<template>
    <!-- Native checkbox in brand green (accent-color; no forms plugin). The input
         and its label are both 44px tall, so the whole row is easy to hit. -->
    <div class="flex items-start gap-3">

        <div class="flex h-11 items-center">

            <input :id="id" v-model="model" :name="name" type="checkbox" :disabled="disabled" :required="required"
                :aria-invalid="error ? 'true' : undefined"
                :aria-describedby="error ? `${id}-error` : helper ? `${id}-helper` : undefined"
                class="h-5 w-5 cursor-pointer rounded accent-brand outline-brand focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60" />

        </div>

        <div class="min-w-0">

            <label :for="id" class="flex min-h-11 cursor-pointer items-center text-sm font-medium text-slate-900">
                {{ label }}

                <span v-if="required" class="ml-0.5 text-red-700" aria-hidden="true">
                    *
                </span>
            </label>

            <p v-if="helper && !error" :id="`${id}-helper`" class="-mt-1 text-sm leading-5 text-slate-600">
                {{ helper }}
            </p>

            <p v-if="error" :id="`${id}-error`" class="-mt-1 flex items-start gap-1.5 text-sm leading-5 font-medium text-red-700">
                <ExclamationCircleIcon class="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{{ error }}</span>
            </p>

        </div>

    </div>
</template>

<script setup>
import { ExclamationCircleIcon } from "@heroicons/vue/20/solid";

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