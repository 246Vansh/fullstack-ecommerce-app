<template>
    <section class="max-w-3xl">

        <h2 class="text-xl font-semibold tracking-tight text-slate-900">
            Shipping information
        </h2>

        <p class="mt-4 text-base leading-7 text-slate-600">
            Any shipping charge for your order is calculated at checkout
            and shown in the order summary before you place your order.
        </p>

        <div class="mt-8 rounded-panel bg-surface p-6">

            <h3 class="flex items-center gap-2 text-base font-semibold text-slate-900">
                <InformationCircleIcon class="h-5 w-5 text-brand" aria-hidden="true" />
                Good to know
            </h3>

            <ul class="mt-4 space-y-3 text-sm leading-6 text-slate-600">

                <li class="flex gap-3">
                    <CheckIcon class="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                    Shipping is calculated for the delivery address you
                    choose at checkout.
                </li>

                <li class="flex gap-3">
                    <CheckIcon class="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                    After you place an order, its confirmation page shows
                    the items, shipping address and totals.
                </li>

            </ul>

        </div>

    </section>
</template>

<script setup>
import { InformationCircleIcon } from "@heroicons/vue/24/outline";
import { CheckIcon } from "@heroicons/vue/20/solid";
</script>
