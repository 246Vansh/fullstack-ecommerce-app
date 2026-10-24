<template>

    <div>

        <p v-if="brand" class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {{ brand }}
        </p>

        <h1 class="mt-2 text-2xl leading-tight font-semibold tracking-tight text-balance text-slate-900 sm:text-3xl">
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