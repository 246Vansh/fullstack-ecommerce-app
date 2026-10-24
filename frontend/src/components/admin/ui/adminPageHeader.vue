<template>
    <!-- Page title row: optional back link, the page's one <h1>, description or
         meta line, and the page's main actions (right on desktop, below on phones).
         Action buttons share the row on phones and wrap when they do not fit. -->
    <div>
        <RouterLink v-if="back" :to="back.to"
            class="-ml-1 inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-sm font-medium text-slate-600 transition-colors hover:text-brand outline-brand focus-visible:outline-2 focus-visible:outline-offset-2">
            <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
            {{ back.label }}
        </RouterLink>

        <!-- Without a title only the back link renders: a failed load's state
             panel is then the page heading. -->
        <div v-if="title || $slots.title" class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" :class="{ 'mt-2': back }">
            <div class="min-w-0">
                <h1 class="wrap-anywhere text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    <slot name="title">{{ title }}</slot>
                </h1>
                <p v-if="description" class="mt-1.5 max-w-2xl text-sm text-slate-600">{{ description }}</p>
                <div v-if="$slots.meta" class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-600">
                    <slot name="meta" />
                </div>
            </div>

            <div v-if="$slots.actions" class="flex shrink-0 flex-wrap gap-2">
                <slot name="actions" />
            </div>
        </div>
    </div>
</template>

<script setup>
import { RouterLink } from "vue-router";
import { ChevronLeftIcon } from "@heroicons/vue/20/solid";

defineProps({
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    // { label, to }: "Back to products", "All orders".
    back: { type: Object, default: null },
});
</script>
