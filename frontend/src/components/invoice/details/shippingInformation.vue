<template>

    <section class="rounded-2xl bg-white shadow-sm">

        <div class="flex items-center gap-4 border-b border-gray-100 px-6 py-4">

            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100">

                <TruckIcon class="h-7 w-7 text-cyan-700" />

            </div>

            <h2 class="text-lg font-bold uppercase">

                Shipping Information

            </h2>

        </div>

        <div class="space-y-6 px-8 py-8">

            <div class="flex justify-between">

                <span class="text-slate-900 font-semibold">

                    Shipping Method

                </span>

                <span class="font-semibold">

                    {{ shipping.method }}

                </span>

            </div>

            <div class="flex justify-between">

                <span class="text-slate-900 font-semibold">

                    Tracking ID

                </span>

                <span class="font-semibold">

                    {{ shipping.trackingId }}

                </span>

            </div>

            <div class="flex justify-between">

                <span class="text-slate-900 font-semibold">

                    Estimated Delivery

                </span>

                <span class="font-semibold">

                    {{ shipping.estimatedDelivery }}

                </span>

            </div>

            <div class="flex justify-between">

                <span class="text-slate-900 font-semibold">

                    Delivery Status

                </span>

                <span class="rounded-lg bg-green-100 px-3 py-1 font-bold uppercase text-green-700">

                    {{ shipping.status }}

                </span>

            </div>

        </div>

    </section>

</template>

<script setup>

import { TruckIcon } from "@heroicons/vue/24/outline";

defineProps({

    shipping: Object

})

</script>