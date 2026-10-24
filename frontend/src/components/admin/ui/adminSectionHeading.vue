<template>
    <!-- Heading row of an admin card: h2 (the card's aria-labelledby target),
         a short description, and optional actions on the right. -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex min-w-0 gap-3">
            <span v-if="step" class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand"
                aria-hidden="true">{{ step }}</span>
            <div class="min-w-0">
                <h2 :id="headingId" class="text-lg font-semibold tracking-tight text-slate-900">{{ title }}</h2>
                <p v-if="text" class="mt-1 text-sm text-slate-600">{{ text }}</p>
            </div>
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 flex-wrap gap-2">
            <slot name="actions" />
        </div>
    </div>
</template>

<script setup>
defineProps({
    headingId: { type: String, required: true },
    title: { type: String, required: true },
    text: { type: String, default: "" },
    // Create form: the section's number (decorative).
    step: { type: String, default: "" },
});
</script>
