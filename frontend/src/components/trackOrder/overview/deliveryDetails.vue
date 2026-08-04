<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-center gap-4 px-6 py-5">

            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100">

                <TruckIcon class="h-6 w-6 text-green-600" />

            </div>

            <h2 class="text-xl font-bold text-slate-900">

                Delivery Details

            </h2>

        </div>

        <!-- Content -->

        <div class="space-y-5 p-6">

            <div class="flex items-center justify-between">

                <div>

                    <p class="text-sm text-slate-500">

                        Delivery Partner

                    </p>

                    <h3 class="mt-1 text-lg font-semibold">

                        BlueDart Express

                    </h3>

                </div>

                <!--<img src="@/assets/images/trackOrder/bluedart.png" class="h-8 object-contain">-->

            </div>

            <div>

                <p class="text-sm text-slate-500">

                    Tracking ID

                </p>

                <div class="mt-2 flex items-center justify-between">

                    <span class="font-semibold">

                        BDX1234567890

                    </span>

                    <DocumentDuplicateIcon class="h-6 w-6 cursor-pointer text-slate-400" />

                </div>

            </div>

            <div>

                <p class="text-sm text-slate-500">

                    Estimated Delivery

                </p>

                <h3 class="mt-2 text-2xl font-bold text-green-600">

                    Tue, 18 Aug 2026

                </h3>

                <p class="mt-1 text-xl font-semibold text-green-600">

                    2–3 Business Days

                </p>

            </div>

            <button
                class="mt-2 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 py-3 font-semibold transition hover:bg-gray-50 cursor-pointer">

                Track on BlueDart

                <ArrowTopRightOnSquareIcon class="h-5 w-5" />

            </button>

        </div>

    </section>

</template>

<script setup>

import {
    TruckIcon,
    DocumentDuplicateIcon,
    ArrowTopRightOnSquareIcon,
} from "@heroicons/vue/24/outline";

</script>