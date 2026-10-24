<template>
    <!-- Disabled renders an aria-disabled link out of the tab order (see PrimaryButton). -->
    <PrimaryButton to="/checkout" size="lg" full-width :disabled="disabled" @click="$emit('checkout')">
        <LockClosedIcon class="h-5 w-5" aria-hidden="true" />
        Proceed to Checkout
    </PrimaryButton>
</template>

<script setup>
import { LockClosedIcon } from "@heroicons/vue/24/solid";

import PrimaryButton from "@/components/ui/primaryButton.vue";

defineProps({
    disabled: {
        type: Boolean,
        default: false,
    },
});

defineEmits([
    "checkout",
]);
</script>
