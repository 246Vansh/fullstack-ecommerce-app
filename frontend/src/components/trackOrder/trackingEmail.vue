<template>

    <section
        class="flex items-center justify-center gap-4 rounded-xl bg-slate-50 px-8 py-6 shadow-sm">

        <InformationCircleIcon class="h-8 w-8 text-blue-600" />

        <p class="text-lg text-slate-600">

            You will receive email updates at

            <span class="font-semibold text-slate-900">

                johndoe@email.com

            </span>

            for every status change.

        </p>

    </section>

</template>

<script setup>

import {
    InformationCircleIcon,
} from "@heroicons/vue/24/outline";

</script>