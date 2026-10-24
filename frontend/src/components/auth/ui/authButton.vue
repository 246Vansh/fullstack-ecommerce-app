<template>
    <!-- The store's primary button, full width. The root is still a <button>:
         callers' type="submit", @click and classes (e.g. the account forms'
         "sm:w-auto sm:px-8") fall through to it. While loading it is disabled
         and shows a spinner. -->
    <PrimaryButton tag="button" :type="type" :disabled="disabled" :loading="loading" full-width>
        <slot />
    </PrimaryButton>
</template>

<script setup>
import PrimaryButton from "@/components/ui/primaryButton.vue";

defineProps({

    type: {
        type: String,
        default: "button",
    },

    disabled: {
        type: Boolean,
        default: false,
    },

    loading: {
        type: Boolean,
        default: false,
    },

});
</script>
