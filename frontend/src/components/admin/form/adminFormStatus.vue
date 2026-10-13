<template>
    <!-- Errors are role="alert" (read at once); success is a polite status. -->
    <div v-if="alert" role="alert" class="rounded-lg border px-4 py-3 text-sm" :class="STYLES[alert.kind] ?? STYLES.error">
        <p class="font-semibold">{{ TITLES[alert.kind] ?? TITLES.error }}</p>
        <p class="mt-0.5">{{ alert.message }}</p>
        <ul v-if="alert.details?.length" class="mt-1 list-disc pl-5">
            <li v-for="(detail, index) in alert.details" :key="index">{{ detail }}</li>
        </ul>
    </div>
    <p v-else-if="success" role="status" class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
        {{ success }}
    </p>
</template>

<script setup>
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
