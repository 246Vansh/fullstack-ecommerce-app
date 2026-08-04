<template>

    <Header />

    <main class="bg-slate-50">

        <div class="mx-auto max-w-[1700px] px-6 py-4">

            <!-- Hero -->
            <successHero :product-count="productCount" :total-quantity="totalQuantity" />

            <!-- Summary + Shipping -->
            <section class="mt-5 grid gap-5 lg:grid-cols-2">

                <orderSummary :order="order" :product-count="productCount" :total-quantity="totalQuantity" />

                <shippingCard :shipping="shipping" />

            </section>

            <!-- Products -->
            <section class="mt-5">

                <purchasedProducts :products="products" />

            </section>

            <!-- Payment + Statistics -->
            <section class="mt-5 grid gap-5 lg:grid-cols-2">

                <paymentCard />

                <orderStatistics />

            </section>

            <!-- Buttons -->
            <section class="mt-7">

                <actionButtons />

            </section>

            <!-- Email -->
            <section class="mt-4">

                <confirmationEmail />

            </section>

        </div>

    </main>
    <Footer />

</template>

<script setup>

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";

import successHero from "@/components/orderSuccess/hero/successHero.vue";

import orderSummary from "@/components/orderSuccess/details/orderSummary.vue";
import shippingCard from "@/components/orderSuccess/details/shippingCard.vue";
import purchasedProducts from "@/components/orderSuccess/details/purchasedProducts.vue";
import paymentCard from "@/components/orderSuccess/details/paymentCard.vue";
import orderStatistics from "@/components/orderSuccess/details/orderStatistics.vue";

import actionButtons from "@/components/orderSuccess/actions/actionButtons.vue";
import confirmationEmail from "@/components/orderSuccess/actions/confirmationEmail.vue";

import { useOrderSuccess } from "@/composables/useOrderSuccess";

const {
    order,
    shipping,
    products,
    productCount,
    totalQuantity,
} = useOrderSuccess();

</script>