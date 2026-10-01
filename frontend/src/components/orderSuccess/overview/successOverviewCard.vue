<template>

    <article
        class="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-5 sm:gap-5 sm:px-6 sm:py-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">

        <!-- Icon -->

        <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" :class="iconBackground">

            <component :is="icon" class="h-7 w-7" :class="iconColor" />

        </div>

        <!-- Content -->

        <div class="min-w-0">

            <p class="text-sm font-medium text-slate-500">

                {{ title }}

            </p>

            <h3 class="mt-1 text-xl font-bold" :class="valueColor">

                {{ value }}

            </h3>

            <p class="mt-1 text-sm text-slate-500">

                {{ subtitle }}

            </p>

        </div>

    </article>

</template>

<script setup>

defineProps({

    icon: [Object, Function],

    title: String,

    value: String,

    subtitle: String,

    iconBackground: String,

    iconColor: String,

    valueColor: {
        type: String,
        default: "text-slate-900",
    },

});

</script>