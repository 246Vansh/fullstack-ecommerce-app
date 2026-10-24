<template>
    <!-- Loading, error, empty and access-denied states for an admin page or list.
         Actions (retry, clear filters, ...) go in the default slot. -->
    <section class="flex min-h-64 flex-col items-center justify-center rounded-card border border-dashed bg-white px-4 py-10 text-center"
        :class="kind === 'forbidden' ? 'border-amber-300' : 'border-slate-300'">

        <LoadingSpinner v-if="kind === 'loading'" class="text-brand" :label="title" />

        <template v-else>
            <span class="flex h-12 w-12 items-center justify-center rounded-full" :class="ICONS[kind].tint" aria-hidden="true">
                <component :is="icon ?? ICONS[kind].icon" class="h-6 w-6" />
            </span>
            <component :is="`h${headingLevel}`" class="mt-4 text-lg font-semibold tracking-tight text-slate-900">
                {{ title }}
            </component>
            <p v-if="message" class="mt-1.5 max-w-md text-sm text-slate-600">{{ message }}</p>
            <div v-if="$slots.default" class="mt-6 flex flex-wrap justify-center gap-3">
                <slot />
            </div>
        </template>

    </section>
</template>

<script setup>
import { ExclamationTriangleIcon, InboxIcon, LockClosedIcon } from "@heroicons/vue/24/outline";

import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";

defineProps({
    // loading | error | empty | forbidden
    kind: { type: String, required: true },
    // Loading: the spinner's announced label. Otherwise the visible heading.
    title: { type: String, required: true },
    message: { type: String, default: "" },
    // 1 on detail pages whose own heading is not shown yet (load failed).
    headingLevel: { type: Number, default: 2 },
    // Replaces the kind's icon (e.g. a cube for "No products yet").
    icon: { type: [Object, Function], default: null },
});

const ICONS = {
    error: { icon: ExclamationTriangleIcon, tint: "bg-red-50 text-red-700" },
    empty: { icon: InboxIcon, tint: "bg-brand-soft text-brand" },
    forbidden: { icon: LockClosedIcon, tint: "bg-amber-50 text-amber-700" },
};
</script>
