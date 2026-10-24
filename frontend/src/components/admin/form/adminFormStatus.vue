<template>
    <!-- Errors are role="alert" (read at once); success is a polite status. -->
    <div v-if="alert" role="alert" class="flex gap-3 rounded-control border px-4 py-3 text-sm" :class="STYLES[alert.kind] ?? STYLES.error">
        <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div class="min-w-0">
            <p class="font-semibold">{{ TITLES[alert.kind] ?? TITLES.error }}</p>
            <p class="mt-0.5 wrap-anywhere">{{ alert.message }}</p>
            <ul v-if="alert.details?.length" class="mt-1 list-disc pl-5">
                <li v-for="(detail, index) in alert.details" :key="index" class="wrap-anywhere">{{ detail }}</li>
            </ul>
        </div>
    </div>
    <p v-else-if="success" role="status" class="flex items-start gap-2 rounded-control border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
        <CheckCircleIcon class="mt-px h-5 w-5 shrink-0" aria-hidden="true" />
        <span class="min-w-0">{{ success }}</span>
    </p>
</template>

<script setup>
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/vue/20/solid";

defineProps({
    alert: { type: Object, default: null },
    success: { type: String, default: "" },
});

const TITLES = {
    invalid: "Check the form",
    conflict: "Not saved: conflict",
    forbidden: "Admin access required",
    error: "Not saved",
};

const STYLES = {
    invalid: "border-red-200 bg-red-50 text-red-800",
    conflict: "border-amber-300 bg-amber-50 text-amber-900",
    forbidden: "border-amber-300 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-800",
};
</script>
