<template>
    <RouterLink to="/products" class="group mt-10 inline-flex items-center gap-3 rounded-2xl border border-indigo-100 px-6 py-3 font-semibold text-indigo-700
        transition-all duration-300
        bg-[radial-gradient(circle_at_82%_18%,rgba(99,102,241,0.18),transparent_48%),radial-gradient(circle_at_18%_8%,rgba(59,130,246,0.10),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8faff_100%)]
        hover:border-indigo-300
        hover:shadow-lg
        hover:shadow-indigo-100/70
        hover:-translate-y-0.5">

        <ArrowLeftIcon class="h-5 w-5 transition-transform duration-300 group-hover:-translate-x-1" />

        <span>Continue Shopping</span>

    </RouterLink>
</template>

<script setup>
import { ArrowLeftIcon } from "@heroicons/vue/24/outline";
import { RouterLink } from "vue-router";
</script>