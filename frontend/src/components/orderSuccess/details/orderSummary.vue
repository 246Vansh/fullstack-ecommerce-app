<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">

            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100">

                <ClipboardDocumentListIcon class="h-5 w-5 text-green-600" />

            </div>

            <h2 class="text-xl font-bold text-slate-900">

                Order Summary

            </h2>

        </div>

        <!-- Content -->

        <div class="space-y-4 px-6 py-5">

            <div class="flex items-center justify-between">

                <span class="font-semibold text-slate-900 text-sm">
                    Order ID
                </span>

                <span class="text-sm font-medium text-slate-700">
                    ODR-2026-004512
                </span>

            </div>

            <div class="flex items-center justify-between">

                <span class="font-semibold text-slate-900 text-sm">
                    Order Date
                </span>

                <span class="text-sm font-medium text-slate-700">
                    14 Aug 2026, 10:24 AM
                </span>

            </div>

            <div class="flex items-center justify-between">

                <span class="font-semibold text-slate-900 text-sm">
                    Total Amount
                </span>

                <span class="text-base font-bold text-orange-600">
                    $489.98
                </span>

            </div>

            <div class="flex items-center justify-between">

                <span class="font-semibold text-slate-900 text-sm">
                    Payment Method
                </span>

                <span class="text-sm font-medium text-slate-700">
                    Visa •••• 4242
                </span>

            </div>

            <div class="flex items-center justify-between">

                <span class="font-semibold text-slate-900 text-sm">
                    Total Items
                </span>

                <span class="text-sm font-medium text-slate-700">
                    4 Items
                </span>

            </div>

            <!-- Divider -->

            <div class="border-t border-gray-100 pt-3">

                <div class="flex items-start justify-between">

                    <span class="font-semibold text-slate-900 text-sm">
                        Estimated Delivery
                    </span>

                    <div class="text-right">

                        <h3 class="text-sm font-bold text-slate-900">

                            Tue, 18 Aug 2026

                        </h3>

                        <p class="mt-0.5 text-xs font-medium text-green-600">

                            2–3 Business Days

                        </p>

                    </div>

                </div>

            </div>

        </div>

    </section>

</template>

<script setup>
import { ClipboardDocumentListIcon } from "@heroicons/vue/24/outline";
</script>