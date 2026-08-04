<template>
    <RouterLink to="/checkout">
        <button type="button" @click="$emit('checkout')"
            class="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 text-base font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/30 active:translate-y-0 cursor-pointer">

            <LockClosedIcon class="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
            <span>
                Proceed to Checkout
            </span>

        </button>
    </RouterLink>
</template>

<script setup>
import { RouterLink } from "vue-router"
import { LockClosedIcon } from "@heroicons/vue/24/solid";

defineEmits([
    "checkout",
]);
</script>