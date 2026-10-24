<template>
    <section class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">

        <div>
            <h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Shopping cart
            </h1>

            <p class="mt-2 text-base text-slate-600">
                Review your items before checking out.
            </p>
        </div>

        <p class="text-sm text-slate-600">
            <span class="font-semibold text-slate-900">{{ itemCount }}</span>
            {{ itemCount === 1 ? "item" : "items" }}
        </p>

    </section>
</template>

<script setup>
defineProps({
    itemCount: {
        type: Number,
        default: 0,
    },
});
</script>
