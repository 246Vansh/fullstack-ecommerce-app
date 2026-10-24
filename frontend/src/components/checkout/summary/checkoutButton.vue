<template>
    <div class="px-5 py-6 sm:px-8 sm:py-7">
        <PrimaryButton tag="button" size="lg" full-width :disabled="disabled" :loading="loading" @click="$emit('place')">
            <LockClosedIcon v-if="!loading" class="h-5 w-5" aria-hidden="true" />
            {{ loading ? "Placing Order..." : "Place Order" }}
        </PrimaryButton>
    </div>
</template>

<script setup>
import { LockClosedIcon } from "@heroicons/vue/24/outline";

import PrimaryButton from "@/components/ui/primaryButton.vue";

defineProps({
    disabled: Boolean,
    loading: Boolean,
});

defineEmits(["place"]);
</script>
