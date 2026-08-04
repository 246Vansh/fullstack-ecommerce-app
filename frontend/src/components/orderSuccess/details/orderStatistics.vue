<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">

            <div class="flex h-11 w-11 items-center justify-center rounded-full bg-green-50">

                <StarIcon class="h-5 w-5 text-green-600" />

            </div>

            <h2 class="text-xl font-bold text-slate-900">

                Order Statistics

            </h2>

        </div>

        <!-- Statistics -->

        <div class="grid grid-cols-2">

            <!-- Payment -->

            <div class="flex items-start gap-3 border-b border-r border-gray-100 p-5">

                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-50">

                    <CheckCircleIcon class="h-6 w-6 text-green-600" />

                </div>

                <div>

                    <h3 class="text-base font-semibold text-slate-900">

                        Payment Confirmed

                    </h3>

                    <p class="mt-1 text-xs leading-5 text-slate-500">

                        Your payment was successfully received.

                    </p>

                </div>

            </div>

            <!-- Delivery -->

            <div class="flex items-start gap-3 border-b border-gray-100 p-5">

                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50">

                    <TruckIcon class="h-6 w-6 text-blue-600" />

                </div>

                <div>

                    <h3 class="text-base font-semibold text-slate-900">

                        Delivery in 2–3 Days

                    </h3>

                    <p class="mt-1 text-xs leading-5 text-slate-500">

                        Your order will be delivered soon.

                    </p>

                </div>

            </div>

            <!-- Security -->

            <div class="flex items-start gap-3 border-r border-gray-100 p-5">

                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-50">

                    <ShieldCheckIcon class="h-6 w-6 text-violet-600" />

                </div>

                <div>

                    <h3 class="text-base font-semibold text-slate-900">

                        Secure Transaction

                    </h3>

                    <p class="mt-1 text-xs leading-5 text-slate-500">

                        Your transaction is 100% secure and protected.

                    </p>

                </div>

            </div>

            <!-- Rewards -->

            <div class="flex items-start gap-3 p-5">

                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-50">

                    <GiftTopIcon class="h-6 w-6 text-amber-500" />

                </div>

                <div>

                    <h3 class="text-base font-semibold text-slate-900">

                        Reward Points

                    </h3>

                    <p class="mt-1 text-xs leading-5 text-slate-500">

                        You earned 48 points with this order.

                    </p>

                </div>

            </div>

        </div>

    </section>

</template>

<script setup>
import {
    StarIcon,
    CheckCircleIcon,
    TruckIcon,
    ShieldCheckIcon,
    GiftTopIcon,
} from "@heroicons/vue/24/outline";
</script>