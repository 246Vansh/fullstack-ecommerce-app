<template>

    <Header />

    <main class="bg-slate-50">

        <div class="mx-auto max-w-[1700px] px-4 py-4">

            <!-- Hero -->
            <trackHero />

            <!-- Timeline -->
            <trackingTimeline class="mt-1" />

            <!-- Overview -->

            <div class="mt-4 grid gap-6 lg:grid-cols-3">

                <deliveryDetails />

                <shippingAddress />

                <orderSummary />

            </div>

            <!-- Purchased Products -->

            <purchasedProducts :products="products" class="mt-6" />

            <!-- Support -->

            <supportCard class="mt-6" />

            <!-- Tracking Email -->

            <trackingEmail class="mt-5" />

        </div>

    </main>

    <Footer />

</template>

<script setup>

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";

import trackHero from "@/components/trackOrder/hero/trackHero.vue";
import trackingTimeline from "../components/trackOrder/trackingTimeline.vue";
import deliveryDetails from "../components/trackOrder/overview/deliveryDetails.vue";
import shippingAddress from "../components/trackOrder/shippingAddress.vue";
import orderSummary from "../components/trackOrder/orderSummary.vue";
import purchasedProducts from "../components/trackOrder/products/purchasedProducts.vue";
import supportCard from "../components/trackOrder/support/supportCard.vue";
import trackingEmail from "../components/trackOrder/trackingEmail.vue";
import { useTrackOrder } from "@/composables/useTrackOrder";

const { order, shipping, delivery, timeline, supportFeatures, products, productCount, totalQuantity, orderTotal
} = useTrackOrder();

</script>