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

                        Order Received

                    </h3>

                    <p class="mt-1 text-xs leading-5 text-slate-500">

                        Your order has been recorded.

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

                        Shipping Updates

                    </h3>

                    <p class="mt-1 text-xs leading-5 text-slate-500">

                        We'll let you know when your order ships.

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

                        Secure Checkout

                    </h3>

                    <p class="mt-1 text-xs leading-5 text-slate-500">

                        Prices and stock were verified by our servers.

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

                        Easy Returns

                    </h3>

                    <p class="mt-1 text-xs leading-5 text-slate-500">

                        30-day hassle-free returns.

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