<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">

            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100">

                <CreditCardIcon class="h-5 w-5 text-violet-600" />

            </div>

            <div>

                <h2 class="text-xl font-bold text-slate-900">

                    Payment Information

                </h2>

                <p class="text-xs text-slate-500">

                    Payment completed successfully

                </p>

            </div>

        </div>

        <!-- Content -->

        <div class="space-y-4 px-6 py-5">

            <div class="flex items-center justify-between">

                <span class="text-sm font-semibold text-slate-900">

                    Payment Method

                </span>

                <span class="text-sm font-medium text-slate-700">

                    Visa •••• 4242

                </span>

            </div>

            <div class="flex items-center justify-between">

                <span class="text-sm font-semibold text-slate-900">

                    Transaction ID

                </span>

                <span class="text-sm font-medium text-slate-700">

                    TXN-84569231

                </span>

            </div>

            <div class="flex items-center justify-between">

                <span class="text-sm font-semibold text-slate-900">

                    Payment Date

                </span>

                <span class="text-sm font-medium text-slate-700">

                    14 Aug 2026

                </span>

            </div>

            <div class="flex items-center justify-between">

                <span class="text-sm font-semibold text-slate-900">

                    Status

                </span>

                <span class="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">

                    Paid

                </span>

            </div>

        </div>

    </section>

</template>

<script setup>
import { CreditCardIcon } from "@heroicons/vue/24/outline";
</script>