<template>

    <div class="px-8 py-7">
        <!-- Disabled until the server says the cart and address are ready, and while placing. -->
            <button type="button" :disabled="disabled || loading" :aria-busy="loading" @click="$emit('place')"
                class="disabled:pointer-events-none disabled:opacity-50 group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 px-6 py-5 text-lg font-semibold text-white shadow-lg shadow-indigo-200 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-300 cursor-pointer">

                <!-- Glow -->
                <div
                    class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.25),transparent_45%)] opacity-70">
                </div>

                <LockClosedIcon class="relative h-6 w-6" />

                <span class="relative">
                    {{ loading ? "Placing Order..." : "Complete Purchase" }}
                </span>

                <ArrowRightIcon class="relative h-5 w-5 transition-transform group-hover:translate-x-1" />

            </button>

        <p class="mt-4 text-center text-sm text-slate-500">

            By placing your order, you agree to our
            <span class="font-medium text-indigo-600">
                Terms & Conditions
            </span>

        </p>

    </div>

</template>

<script setup>
import {
    ArrowRightIcon,
    LockClosedIcon,
} from "@heroicons/vue/24/outline";

defineProps({
    disabled: Boolean,
    loading: Boolean,
});

defineEmits(["place"]);
</script>