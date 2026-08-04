<template>
    <section class="rounded-xl border border-gray-200 bg-white p-7 mt-3 shadow-sm">

        <!-- Heading -->
        <h3 class="mb-6 text-xl font-bold text-slate-900">
            We Accept
        </h3>

        <!-- Payment Logos -->
        <div class="flex flex-wrap gap-4">

            <button v-for="method in methods" :key="method.name" type="button"
                class="group flex h-12 w-16 items-center justify-center rounded-xl border border-gray-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400 hover:shadow-md cursor-pointer">

                <img :src="method.logo" :alt="method.name" :class="[method.width, method.height]"
                    class="object-contain transition-transform duration-300 group-hover:scale-105" />

            </button>

        </div>

    </section>
</template>

<script setup>
import visa from "@/assets/payment/visa-logo.png";
import mastercard from "@/assets/payment/mastercard.webp";
import amex from "@/assets/payment/amex.svg";
import applePay from "@/assets/payment/apple-pay.png";
import googlePay from "@/assets/payment/google-pay.png";

const methods = [
    {
        name: "Visa",
        logo: visa,
        width: "w-26",
        height: "h-10",
    },
    {
        name: "Mastercard",
        logo: mastercard,
        width: "w-16",
        height: "h-16",
    },
    {
        name: "American Express",
        logo: amex,
        width: "w-30",
        height: "h-10",
    },
    {
        name: "Apple Pay",
        logo: applePay,
        width: "w-28",
        height: "h-15",
    },
    {
        name: "Google Pay",
        logo: googlePay,
        width: "w-28",
        height: "h-15",
    },
];
</script>