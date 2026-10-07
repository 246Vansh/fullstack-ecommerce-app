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

                    {{ address.firstName }} {{ address.lastName }}

                </p>

            </div>

            <!-- Phone -->

            <div class="flex items-start gap-3">

                <PhoneIcon class="mt-0.5 h-5 w-5 shrink-0 text-slate-900" />

                <p class="text-sm font-semibold text-slate-700">

                    {{ address.phone }}

                </p>

            </div>

            <!-- Address -->

            <div class="flex items-start gap-3">

                <HomeIcon class="mt-0.5 h-5 w-5 shrink-0 text-slate-900" />

                <div class="space-y-0.5 text-sm font-semibold text-slate-700">

                    <p>

                        {{ [address.address, address.apartment].filter(Boolean).join(", ") }}

                    </p>

                    <p>

                        {{ address.city }}, {{ address.state }} {{ address.zipCode }}

                    </p>

                    <p>

                        {{ address.country }}

                    </p>

                </div>

            </div>

            <!-- No delivery method: orders do not store one yet. -->

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

// The shipping address snapshot stored on the order.
defineProps({
    address: {
        type: Object,
        required: true,
    },
});
</script>