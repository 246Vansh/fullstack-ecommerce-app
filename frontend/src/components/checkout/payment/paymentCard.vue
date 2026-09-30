<template>

    <checkoutSection number="03" title="Payment" subtitle="Online payment is coming soon." :icon="CreditCardIcon"
        :editable="false">

        <!-- No payment provider is integrated yet, so nothing is selectable here. -->

        <p class="rounded-2xl border border-dashed border-gray-300 bg-slate-50 px-5 py-4 text-slate-600">

            No payment details are collected at checkout yet. Your order will be placed with a
            <span class="font-semibold text-slate-800">Pending</span> status.

        </p>

    </checkoutSection>

</template>

<script setup>
import { CreditCardIcon } from "@heroicons/vue/24/outline";

import checkoutSection from "../common/checkoutSection.vue";
</script>
