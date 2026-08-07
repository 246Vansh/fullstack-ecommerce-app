<template>

    <Header />

    <main class="bg-slate-50">

        <div class="mx-auto max-w-[1700px] px-6 py-6">

            <!-- Hero -->

            <invoiceHero  :company="company" :invoice="invoice"/>

            <!-- Address Cards -->

            <div class="mt-6 grid gap-6 lg:grid-cols-3">

                <companyCard :company="company" />

                <billingCard :billing="billing" />

                <shippingCard :shipping="shipping" />

            </div>

            <!-- Invoice Information -->

            <invoiceInformation class="mt-6" :invoice="invoice" :payment="payment" />

            <!-- Payment -->

            <div class="mt-6 grid gap-6 lg:grid-cols-[400px_400px_minmax(0,1.6fr)]">

                <paymentInformation :payment="payment" />

                <shippingInformation :shipping="shipping" />

                <!-- Terms -->
                <termsConditions/>

            </div>
        </div>

    </main>

    <Footer />

</template>

<script setup>

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";

import invoiceHero from "@/components/invoice/hero/invoiceHero.vue";

import companyCard from "@/components/invoice/information/companyCard.vue";
import billingCard from "@/components/invoice/information/billingCard.vue";
import shippingCard from "@/components/invoice/information/shippingCard.vue";
import invoiceInformation from "@/components/invoice/information/invoiceInformation.vue";

import paymentInformation from "@/components/invoice/details/paymentInformation.vue";
import shippingInformation from "@/components/invoice/details/shippingInformation.vue";
import termsConditions from "@/components/invoice/details/termsConditions.vue";

import { useInvoice } from "@/composables/useInvoice";
import { onServerPrefetch } from "vue";

const { company, billing, shipping, payment, invoice, terms, products, productCount, totalQuantity } = useInvoice();

</script>