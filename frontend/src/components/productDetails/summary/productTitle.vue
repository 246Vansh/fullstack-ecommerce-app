<template>

    <div>

        <p v-if="brand" class="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            {{ brand }}
        </p>

        <h1 class="text-2xl font-bold leading-tight tracking-tight text-gray-900">
            {{ title }}
        </h1>

    </div>

</template>

<script setup>
defineProps({
    brand: String,
    title: String,
});
</script>