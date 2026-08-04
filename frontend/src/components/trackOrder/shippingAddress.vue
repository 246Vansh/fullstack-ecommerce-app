<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <div class="flex items-center gap-4 px-6 py-5">

            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100">

                <MapPinIcon class="h-6 w-6 text-green-600" />

            </div>

            <h2 class="text-xl font-bold">

                Shipping Address

            </h2>

        </div>

        <div class="space-y-5 p-6">

            <div class="flex gap-4">

                <UserIcon class="h-5 w-5 text-slate-400" />

                <p>John Doe</p>

            </div>

            <div class="flex gap-4">

                <PhoneIcon class="h-5 w-5 text-slate-400" />

                <p>+1 (555) 123-4567</p>

            </div>

            <div class="flex gap-4">

                <HomeIcon class="h-5 w-5 text-slate-400" />

                <div>

                    <p>123 Main Street, Apartment 5B</p>

                    <p>New York, NY 10001</p>

                    <p>United States</p>

                </div>

            </div>

            <button
                class="mt-24 flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 py-3 font-semibold transition hover:bg-gray-50 cursor-pointer">

                <MapPinIcon class="h-5 w-5" />

                View on Map

            </button>

        </div>

    </section>

</template>

<script setup>

import {

    MapPinIcon,
    UserIcon,
    PhoneIcon,
    HomeIcon,

} from "@heroicons/vue/24/outline";

</script>