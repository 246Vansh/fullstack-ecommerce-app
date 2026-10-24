<template>
    <!-- The parent's @click falls through to the <button>; a disabled one fires nothing. -->
    <PrimaryButton tag="button" size="lg" full-width :disabled="disabled" class="flex-1">
        <ShoppingBagIcon class="h-5 w-5" aria-hidden="true" />
        Add to Cart
    </PrimaryButton>
</template>

<script setup>
import { ShoppingBagIcon } from "@heroicons/vue/24/outline";

import PrimaryButton from "@/components/ui/primaryButton.vue";

defineProps({
    disabled: Boolean,
});
</script>
