<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-center gap-3 border-b border-gray-100 px-6 py-4">

            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100">

                <MapPinIcon class="h-5 w-5 text-green-600" />

            </div>

            <h2 class="text-xl font-bold text-slate-900">

                Shipping Address

            </h2>

        </div>

        <!-- Content -->

        <div class="space-y-4 px-6 py-5">

            <!-- Name -->

            <div class="flex items-start gap-3">

                <UserIcon class="mt-0.5 h-5 w-5 shrink-0 text-slate-900" />

                <p class="text-sm font-semibold text-slate-900">

                    John Doe

                </p>

            </div>

            <!-- Phone -->

            <div class="flex items-start gap-3">

                <PhoneIcon class="mt-0.5 h-5 w-5 shrink-0 text-slate-900" />

                <p class="text-sm font-semibold text-slate-700">

                    +1 (555) 123-4567

                </p>

            </div>

            <!-- Address -->

            <div class="flex items-start gap-3">

                <HomeIcon class="mt-0.5 h-5 w-5 shrink-0 text-slate-900" />

                <div class="space-y-0.5 text-sm font-semibold text-slate-700">

                    <p>

                        123 Main Street, Apartment 5B

                    </p>

                    <p>

                        New York, NY 10001

                    </p>

                    <p>

                        United States

                    </p>

                </div>

            </div>

            <!-- Divider -->

            <div class="border-t border-gray-100"></div>

            <!-- Delivery -->

            <div class="flex items-start gap-3">

                <TruckIcon class="mt-0.5 h-5 w-5 shrink-0 text-slate-900" />

                <div>

                    <p class="text-sm font-bold text-slate-900">

                        Delivery Method

                    </p>

                    <p class="mt-0.5 text-xs font-semibold text-slate-500">

                        Standard Shipping (2–3 Business Days)

                    </p>

                </div>

            </div>

        </div>

    </section>

</template>

<script setup>
import {
    MapPinIcon,
    UserIcon,
    PhoneIcon,
    HomeIcon,
    TruckIcon,
} from "@heroicons/vue/24/outline";
</script>