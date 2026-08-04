<template>

    <section class="border-t border-gray-100 bg-slate-50 px-8 py-7">

        <div class="space-y-5">

            <!-- Secure -->

            <div class="flex items-center gap-4">

                <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">

                    <ShieldCheckIcon class="h-6 w-6 text-emerald-600" />

                </div>

                <div>

                    <h4 class="font-semibold text-slate-900">

                        Secure Payment

                    </h4>

                    <p class="text-sm text-slate-500">

                        SSL encrypted checkout.

                    </p>

                </div>

            </div>

            <!-- Returns -->

            <div class="flex items-center gap-4">

                <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">

                    <ArrowPathRoundedSquareIcon class="h-6 w-6 text-blue-600" />

                </div>

                <div>

                    <h4 class="font-semibold text-slate-900">

                        Easy Returns

                    </h4>

                    <p class="text-sm text-slate-500">

                        30-day hassle-free returns.

                    </p>

                </div>

            </div>

            <!-- Shipping -->

            <div class="flex items-center gap-4">

                <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100">

                    <TruckIcon class="h-6 w-6 text-orange-600" />

                </div>

                <div>

                    <h4 class="font-semibold text-slate-900">

                        Fast Delivery

                    </h4>

                    <p class="text-sm text-slate-500">

                        Express shipping available.

                    </p>

                </div>

            </div>

        </div>

    </section>

</template>

<script setup>
import {
    ShieldCheckIcon,
    TruckIcon,
    ArrowPathRoundedSquareIcon,
} from "@heroicons/vue/24/outline";
</script>