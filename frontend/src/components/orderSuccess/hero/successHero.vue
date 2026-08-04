<template>

    <section
        class="relative overflow-hidden rounded-xl bg-white shadow-[0_12px_40px_rgba(15,23,42,.05)]">

        <!-- Background -->

        <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(34,197,94,0.06),transparent_35%),radial-gradient(circle_at_82%_20%,rgba(59,130,246,0.05),transparent_40%),linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)]">
        </div>

        <div class="relative">

            <!-- Hero -->

            <div class="grid items-center gap-10 px-14 pt-10 pb-8 lg:grid-cols-[minmax(0,1fr)_560px]">

                <!-- LEFT -->

                <div class="flex items-center gap-20">

                    <!-- Success Icon -->

                    <div class="relative shrink-0 -translate-y-16">

                        <!-- Glow -->

                        <div class="absolute inset-0 rounded-full bg-green-300/30 blur-3xl">
                        </div>

                        <!-- Circle -->

                        <div
                            class="relative flex h-44 w-44 items-center justify-center rounded-full bg-green-600 shadow-[0_20px_60px_rgba(34,197,94,.35)]">

                            <CheckIcon class="h-24 w-24 stroke-[3] text-white" />

                        </div>

                        <!-- Confetti -->

                        <span class="absolute -left-6 top-8 h-3 w-3 rotate-45 bg-sky-500"></span>
                        <span class="absolute -left-4 bottom-10 h-3 w-8 -rotate-45 rounded-full bg-blue-500"></span>
                        <span class="absolute -right-5 top-3 h-3 w-6 rotate-45 bg-violet-500"></span>
                        <span class="absolute right-2 -bottom-5 h-3 w-8 rotate-45 bg-green-500"></span>
                        <span class="absolute -left-6 top-24 h-3 w-3 rounded-full bg-yellow-400"></span>
                        <span class="absolute right-0 top-28 h-3 w-3 rotate-45 bg-orange-400"></span>
                        <span class="absolute left-8 -top-5 h-2 w-2 rounded-full bg-blue-400"></span>
                        <span class="absolute right-10 -top-4 h-2 w-6 rotate-45 bg-green-500"></span>

                    </div>

                    <!-- Content -->

                    <div>

                        <h1 class="max-w-[640px] text-4xl font-extrabold leading-[1.12] tracking-tight text-slate-900">

                            Your order has been

                            <span class="block text-green-600">

                                placed successfully!

                            </span>

                        </h1>

                        <p class="mt-5 max-w-xl text-lg leading-8 text-slate-600">

                            Thank you for shopping with us.

                            We've received your order and it is now being processed.

                        </p>

                        <!-- Order Card -->

                        <div
                            class="mt-8 inline-flex translate-x-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">

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

                </div>

                <!-- RIGHT -->

                <div class="relative flex translate-x-6 translate-y-3 justify-center">

                    <!-- Glow -->

                    <div class="absolute h-[420px] w-[420px] rounded-full bg-green-100/40 blur-[120px]">
                    </div>

                    <!-- Illustration -->

                    <img src="@/assets/images/orderSuccess/order-success.png" alt="Order Success"
                        class="relative z-10 w-[560px] max-w-full object-contain" />

                </div>

            </div>

            <!-- Overview Cards -->

            <div class="px-14 pb-10">

                <successOverviewCards :product-count="productCount" :total-quantity="totalQuantity" />

            </div>

        </div>

    </section>

</template>

<script setup>
import {
    CheckIcon,
    DocumentDuplicateIcon,
} from "@heroicons/vue/24/outline";

import successOverviewCards from "../overview/successOverviewCards.vue";

defineProps({

    productCount: Number,

    totalQuantity: Number,

});
</script>