<template>

    <checkoutSection number="02" title="Shipping Address" subtitle="Where should we deliver your order?"
        :icon="MapPinIcon">

        <div class="flex items-start justify-between">

            <!-- Address -->

            <div>

                <h3 class="text-xl font-semibold text-slate-900">
                    Home
                </h3>

                <p class="mt-3 max-w-xl leading-7 text-slate-600">

                    1450 Park Avenue,
                    Apartment 12B,
                    New York,
                    NY 10029,
                    United States

                </p>

            </div>

            <!-- Badge -->

            <span class="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-600">

                Default

            </span>

        </div>

    </checkoutSection>

</template>

<script setup>
import { MapPinIcon } from "@heroicons/vue/24/outline";
import checkoutSection from "../common/checkoutSection.vue";
</script>