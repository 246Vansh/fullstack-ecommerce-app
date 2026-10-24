<template>
    <PrimaryButton to="/checkout" size="lg" full-width @click="$emit('checkout')">
        <LockClosedIcon class="h-5 w-5" aria-hidden="true" />
        Proceed to Checkout
    </PrimaryButton>
</template>

<script setup>
import { LockClosedIcon } from "@heroicons/vue/24/solid";

import PrimaryButton from "@/components/ui/primaryButton.vue";

defineEmits([
    "checkout",
]);
</script>
