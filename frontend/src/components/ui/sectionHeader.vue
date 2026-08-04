<template>
    <div class="sm:flex sm:items-baseline sm:justify-between">

        <!-- Section Title -->
        <h2 :id="headingId" class="text-2xl font-bold tracking-tight text-gray-900">
            {{ title }}
        </h2>

        <!-- Desktop Link -->
        <a v-if="linkText" :href="linkHref"
            class="hidden text-sm font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-500 sm:block">
            {{ linkText }}

            <span aria-hidden="true">
                &rarr;
            </span>
        </a>

    </div>

    <!-- Mobile Link -->
    <div v-if="linkText" class="mt-6 sm:hidden">
        <a :href="linkHref"
            class="block text-sm font-semibold text-indigo-600 transition-colors duration-200 hover:text-indigo-500">
            {{ linkText }}

            <span aria-hidden="true">
                &rarr;
            </span>
        </a>
    </div>
</template>

<script setup>
defineProps({
    headingId: {
        type: String,
        default: "",
    },

    title: {
        type: String,
        required: true,
    },

    linkText: {
        type: String,
        default: "",
    },

    linkHref: {
        type: String,
        default: "#",
    },
});
</script>