<template>

    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

        <div class="min-w-0">

            <h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Checkout
            </h1>

            <p class="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <ShieldCheckIcon class="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                Secure checkout. Prices and totals are confirmed by our servers.
            </p>

        </div>

        <checkoutProgress current-step="checkout" />

    </section>

</template>

<script setup>
import { ShieldCheckIcon } from "@heroicons/vue/24/outline";
import checkoutProgress from "../progress/checkoutProgress.vue";
</script>
