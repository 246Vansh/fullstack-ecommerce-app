<template>

    <div class="space-y-1.5">

        <!-- Label -->

        <label v-if="label" :for="id" class="block text-sm font-medium text-slate-900">
            {{ label }}

            <!-- The input itself is marked required; the asterisk is visual only. -->

            <span v-if="required" class="ml-0.5 text-red-700" aria-hidden="true">
                *
            </span>
        </label>

        <!-- Input -->

        <slot />

        <!-- Helper -->

        <p v-if="helper && !error" :id="`${id}-helper`" class="text-sm leading-5 text-slate-600">
            {{ helper }}
        </p>

        <!-- Error: the icon means it is not shown by colour alone; the text (the
             input's aria-describedby target) is unchanged. -->

        <p v-if="error" :id="`${id}-error`" class="flex items-start gap-1.5 text-sm leading-5 font-medium text-red-700">
            <ExclamationCircleIcon class="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{{ error }}</span>
        </p>

    </div>

</template>

<script setup>
import { ExclamationCircleIcon } from "@heroicons/vue/20/solid";

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
