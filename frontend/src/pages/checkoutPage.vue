<template>
    <Header />

    <main class="bg-slate-50">

        <div class="mx-auto max-w-[1850px] px-8 py-8">

            <div class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_470px]">

                <!-- LEFT COLUMN -->
                <section class="space-y-6">

                    <checkoutHero />

                    <contactCard />

                    <shippingCard />

                    <deliveryCard />

                    <paymentCard />

                    <couponCard />

                    <notesCard />

                </section>

                <!-- RIGHT COLUMN -->
                <aside class="sticky top-8">

                    <orderSummary :products="products" :subtotal="subtotal" :discount="discount" :shipping="shipping"
                        :tax="tax" :total="total" />

                </aside>

            </div>

        </div>

    </main>

    <Footer />
</template>

<script setup>

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";

import checkoutHero from "@/components/checkout/hero/checkoutHero.vue";

import contactCard from "@/components/checkout/contact/contactCard.vue";
import shippingCard from "@/components/checkout/address/shippingCard.vue";
import deliveryCard from "@/components/checkout/delivery/deliveryCard.vue";
import paymentCard from "@/components/checkout/payment/paymentCard.vue";
import couponCard from "@/components/checkout/coupon/couponCard.vue";
import notesCard from "@/components/checkout/notes/notesCard.vue";

import orderSummary from "@/components/checkout/summary/orderSummary.vue";

import { useCheckout } from "@/composables/useCheckout";

const { products, subtotal, discount, shipping, tax, total } = useCheckout();
</script>