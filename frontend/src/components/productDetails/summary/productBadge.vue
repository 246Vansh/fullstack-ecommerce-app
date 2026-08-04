<template>

    <span v-if="badge"
        class="inline-flex w-fit items-center rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-gray-700 shadow-sm">
        {{ badge.name }}
    </span>

</template>

<script setup>
defineProps({
    badge: Object,
});
</script>