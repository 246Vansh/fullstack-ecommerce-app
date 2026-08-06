<template>

    <section class="rounded-2xl bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-center gap-4 border-b border-gray-100 px-6 py-4">

            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">

                <CreditCardIcon class="h-7 w-7 text-violet-700" />

            </div>

            <h2 class="text-lg font-bold uppercase">

                Payment Information

            </h2>

        </div>

        <!-- Content -->

        <div class="space-y-4 px-8 py-4">

            <div class="flex justify-between">

                <span class="text-slate-900 font-semibold">

                    Payment Method

                </span>

                <span class="font-semibold">

                    {{ payment.method }}

                </span>

            </div>

            <div class="flex justify-between">

                <span class="text-slate-900 font-semibold">

                    Payment Status

                </span>

                <span class="rounded-lg bg-green-100 px-3 py-1 font-bold uppercase text-green-700">

                    {{ payment.paymentStatus }}

                </span>

            </div>

            <div class="flex justify-between">

                <span class="text-slate-900 font-semibold">

                    Transaction ID

                </span>

                <span class="font-bold">

                    {{ payment.transactionId }}

                </span>

            </div>

            <div class="flex justify-between">

                <span class="text-slate-900 font-semibold">

                    Amount Paid

                </span>

                <span class="text-xl font-bold">

                    ${{ payment.paidAmount }}

                </span>

            </div>

        </div>

    </section>

</template>

<script setup>

import { CreditCardIcon } from "@heroicons/vue/24/outline";

defineProps({
    payment: {
        type: Object,
        default: () => {}
    }
})

</script>