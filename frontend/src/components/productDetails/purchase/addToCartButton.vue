<template>
    <!-- The parent's @click falls through to the <button>; a disabled one fires nothing. -->
    <PrimaryButton tag="button" size="lg" full-width :disabled="disabled" :loading="loading" class="flex-1">
        <ShoppingBagIcon v-if="!loading" class="h-5 w-5" aria-hidden="true" />
        Add to Cart
    </PrimaryButton>
</template>

<script setup>
import { ShoppingBagIcon } from "@heroicons/vue/24/outline";

import PrimaryButton from "@/components/ui/primaryButton.vue";

defineProps({
    disabled: Boolean,

    // While the cart request runs: a spinner in place of the bag icon.
    loading: Boolean,
});
</script>
