<template>

    <section class="relative overflow-hidden bg-white">

        <!-- Background -->

        <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,.14),transparent_32%),radial-gradient(circle_at_80%_18%,rgba(59,130,246,.05),transparent_35%),linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)]">
        </div>

        <div class="relative grid items-center gap-12 px-10 py-10 lg:grid-cols-[minmax(0,1fr)_520px]">

            <!-- Left -->

            <div>

                <!-- Heading -->

                <h1 class=" text-5xl font-bold tracking-tight text-slate-900">

                    Track Your Order

                </h1>

                <p class="mt-4 max-w-xl text-lg leading-8 text-slate-600">

                    Here's the latest update on your order.

                </p>

                <!-- Order Number -->

                <div class="mt-8 inline-flex overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">

                    <div class="flex items-center px-8 py-4">

                        <span class="text-xl font-bold text-green-600">

                            Order #ODR-2026-004512

                        </span>

                    </div>

                    <button
                        class="flex items-center justify-center border-l border-gray-200 px-6 transition hover:bg-slate-50 cursor-pointer">

                        <DocumentDuplicateIcon class="h-6 w-6 text-slate-500" />

                    </button>

                </div>

            </div>

            <!-- Right -->

            <div class="relative flex justify-center">

                <!-- Glow -->

                <div class="absolute h-105 w-105 rounded-full bg-green-100/40 blur-[120px]">
                </div>

                <!-- Illustration -->

                <img src="@/assets/images/trackOrder/truck.png" alt="Track Order"
                    class="relative z-10 w-130 max-w-full object-contain" />
            </div>

        </div>

    </section>

</template>

<script setup>

import {
    ChevronRightIcon,
    DocumentDuplicateIcon,
} from "@heroicons/vue/24/outline";

</script>