<template>

    <checkoutSection number="04" title="Payment Method" subtitle="Choose how you'd like to pay." :icon="CreditCardIcon">

        <div class="space-y-4">

            <paymentOption v-for="method in methods" :key="method.id" :method="method"
                :selected="selected === method.id" @select="selected = method.id" />

        </div>

    </checkoutSection>

</template>

<script setup>
import { ref } from "vue";

import { CreditCardIcon } from "@heroicons/vue/24/outline";

import checkoutSection from "../common/checkoutSection.vue";
import paymentOption from "./paymentOption.vue";

import visa from "@/assets/payment/visa-logo.png";
import mastercard from "@/assets/payment/mastercard.webp";
import paypal from "@/assets/payment/paypal-logo.svg";

const selected = ref(1);

const methods = [

    {
        id: 1,
        name: "Visa / Mastercard",
        description: "Pay securely using your debit or credit card.",
        logo: visa,
    },

    {
        id: 2,
        name: "PayPal",
        description: "Fast checkout with your PayPal account.",
        logo: paypal,
    },

    {
        id: 3,
        name: "Mastercard",
        description: "Secure payment powered by Mastercard.",
        logo: mastercard,
    },

];
</script>