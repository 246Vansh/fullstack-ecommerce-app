<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <div class="flex items-center gap-4 px-6 py-5">

            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100">

                <ClipboardDocumentListIcon class="h-6 w-6 text-green-600" />

            </div>

            <h2 class="text-xl font-bold">

                Order Summary

            </h2>

        </div>

        <div class="space-y-7 p-6">

            <div class="flex justify-between">

                <span>Order Date</span>

                <span class="font-semibold">

                    14 Aug 2026, 10:24 AM

                </span>

            </div>

            <div class="flex justify-between">

                <span>Payment Method</span>

                <span class="font-semibold">

                    Visa •••• 4242

                </span>

            </div>

            <div class="flex justify-between">

                <span>Total Items</span>

                <span class="font-semibold">

                    4 Items

                </span>

            </div>

            <div class="flex justify-between items-end">

                <span>Order Total</span>

                <span class="text-4xl font-bold text-orange-600">

                    $489.98

                </span>

            </div>

        </div>

    </section>

</template>

<script setup>

import {

    ClipboardDocumentListIcon,

} from "@heroicons/vue/24/outline";

</script>