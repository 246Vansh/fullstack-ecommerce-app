<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <div class="grid lg:grid-cols-[1.65fr_1fr_1fr_1fr]">

            <!-- Need Help -->

            <div class="bg-gradient-to-r from-green-50/60 to-white px-10 py-9">

                <div class="flex items-start gap-6">

                    <!-- Icon -->

                    <div class="flex h-18 w-18 shrink-0 items-center justify-center rounded-full bg-green-100">

                        <PhoneIcon class="h-9 w-9 text-green-600" />

                    </div>

                    <!-- Content -->

                    <div>

                        <h2 class="text-4xl font-bold text-slate-900">

                            Need Help?

                        </h2>

                        <p class="mt-3 max-w-sm text-lg leading-8 text-slate-600">

                            Our support team is here to help you with any questions
                            about your order.

                        </p>

                        <button
                            class="mt-8 flex cursor-pointer items-center gap-4 rounded-2xl border border-gray-300 bg-white px-8 py-4 text-lg font-semibold shadow-sm transition hover:bg-gray-50">

                            Contact Support

                            <ArrowRightIcon class="h-6 w-6" />

                        </button>

                    </div>

                </div>

            </div>

            <!-- Fast Delivery -->

            <div class="flex flex-col items-center justify-center border-l border-gray-100 px-8 py-10 text-center">

                <div class="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">

                    <TruckIcon class="h-9 w-9 text-green-600" />

                </div>

                <h3 class="mt-6 text-2xl font-semibold text-slate-900">

                    Fast Delivery

                </h3>

                <p class="mt-3 text-lg leading-8 text-slate-500">

                    Quick and reliable shipping service

                </p>

            </div>

            <!-- Packaging -->

            <div class="flex flex-col items-center justify-center border-l border-gray-100 px-8 py-10 text-center">

                <div class="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">

                    <CubeIcon class="h-9 w-9 text-green-600" />

                </div>

                <h3 class="mt-6 text-2xl font-semibold text-slate-900">

                    Secure Packaging

                </h3>

                <p class="mt-3 text-lg leading-8 text-slate-500">

                    Your items are packed with extra care

                </p>

            </div>

            <!-- Returns -->

            <div class="flex flex-col items-center justify-center border-l border-gray-100 px-8 py-10 text-center">

                <div class="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">

                    <ArrowPathRoundedSquareIcon class="h-9 w-9 text-green-600" />

                </div>

                <h3 class="mt-6 text-2xl font-semibold text-slate-900">

                    Easy Returns

                </h3>

                <p class="mt-3 text-lg leading-8 text-slate-500">

                    Hassle-free returns within 30 days

                </p>

            </div>

        </div>

    </section>

</template>

<script setup>

import {
    PhoneIcon,
    TruckIcon,
    CubeIcon,
    ArrowPathRoundedSquareIcon,
    ArrowRightIcon,
} from "@heroicons/vue/24/outline";

</script>