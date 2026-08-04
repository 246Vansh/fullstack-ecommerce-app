<template>

    <section class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

        <!-- Timeline -->

        <div class="px-10 pt-10">

            <div class="relative">

                <!-- Progress Line -->

                <div class="absolute left-[8%] right-[8%] top-8 h-1 bg-gray-200">
                </div>

                <!-- Completed Progress -->

                <div class="absolute left-[8%] top-8 h-1 w-[58%] bg-green-500">
                </div>

                <!-- Steps -->

                <div class="relative grid grid-cols-6">

                    <!-- Step -->

                    <div v-for="step in timeline" :key="step.id" class="flex flex-col items-center text-center">

                        <!-- Circle -->

                        <div class="relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-white"
                            :class="step.completed
                                ? 'border-green-500'
                                : 'border-gray-300'">

                            <component :is="step.icon" class="h-8 w-8" :class="step.completed
                                ? 'text-green-600'
                                : 'text-slate-400'" />

                            <!-- Tick -->

                            <div v-if="step.completed && !step.active"
                                class="absolute -bottom-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-600">

                                <CheckIcon class="h-4 w-4 text-white" />

                            </div>

                        </div>

                        <!-- Title -->

                        <h3 class="mt-6 text-lg font-semibold" :class="step.active
                            ? 'text-green-600'
                            : 'text-slate-900'">

                            {{ step.title }}

                        </h3>

                        <!-- Time -->

                        <p class="mt-2 text-sm text-slate-500">

                            {{ step.time }}

                        </p>

                    </div>

                </div>

            </div>

        </div>

        <!-- Bottom Banner -->

        <div class="mx-6 my-8 flex items-center justify-center gap-3 rounded-2xl bg-green-50 px-6 py-5">

            <TruckIcon class="h-8 w-8 text-green-600" />

            <p class="text-base">

                <span class="font-bold text-green-600">

                    Good news!

                </span>

                <span class="text-slate-600">

                    Your order is on the way and will be delivered soon.

                </span>

            </p>

        </div>

    </section>

</template>

<script setup>

import {

    CheckIcon,

    ClipboardDocumentListIcon,

    CreditCardIcon,

    CubeIcon,

    TruckIcon,

    MapPinIcon,

    HomeIcon,

} from "@heroicons/vue/24/outline";

const timeline = [

    {
        id: 1,
        title: "Order Placed",
        time: "14 Aug, 10:24 AM",
        icon: ClipboardDocumentListIcon,
        completed: true,
        active: false,
    },

    {
        id: 2,
        title: "Payment Confirmed",
        time: "14 Aug, 10:26 AM",
        icon: CreditCardIcon,
        completed: true,
        active: false,
    },

    {
        id: 3,
        title: "Packed",
        time: "15 Aug, 08:15 AM",
        icon: CubeIcon,
        completed: true,
        active: false,
    },

    {
        id: 4,
        title: "Shipped",
        time: "15 Aug, 11:30 AM",
        icon: TruckIcon,
        completed: true,
        active: true,
    },

    {
        id: 5,
        title: "Out for Delivery",
        time: "—",
        icon: MapPinIcon,
        completed: false,
        active: false,
    },

    {
        id: 6,
        title: "Delivered",
        time: "—",
        icon: HomeIcon,
        completed: false,
        active: false,
    },

];

</script>