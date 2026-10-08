<template>

    <Header />

    <main id="main-content" tabindex="-1" class="bg-slate-50">

        <div class="mx-auto max-w-[1700px] px-4 py-4 sm:px-6">

            <!-- Loading -->
            <section v-if="loading && !order"
                class="flex min-h-100 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
                <LoadingSpinner class="text-gray-400" label="Loading your order" />
            </section>

            <!-- Error: never fall back to placeholder order data -->
            <section v-else-if="!order"
                class="flex min-h-100 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-center">
                <h1 class="text-2xl font-bold text-gray-900">Order unavailable</h1>
                <p class="mt-2 text-gray-500">{{ error }}</p>
                <div class="mt-6 flex gap-4">
                    <button type="button"
                        class="rounded-xl border border-gray-200 px-6 py-3 font-semibold text-slate-700 hover:bg-gray-50 cursor-pointer"
                        @click="load()">
                        Try again
                    </button>
                    <RouterLink to="/products"
                        class="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700">
                        Continue Shopping
                    </RouterLink>
                </div>
            </section>

            <template v-else>

                <!-- Hero -->
                <successHero :order="order" :product-count="productCount" :total-quantity="totalQuantity" />

                <!-- Summary + Shipping -->
                <section class="mt-5 grid gap-5 lg:grid-cols-2">

                    <orderSummary :order="order" :product-count="productCount" :total-quantity="totalQuantity" />

                    <shippingCard :address="order.shippingAddress" />

                </section>

                <!-- Products -->
                <section class="mt-5">

                    <purchasedProducts :products="order.items" />

                </section>

                <!-- Payment + Statistics -->
                <section class="mt-5 grid gap-5 lg:grid-cols-2">

                    <paymentCard :order="order" />

                    <orderStatistics />

                </section>

                <!-- Buttons -->
                <section class="mt-7">

                    <actionButtons :order-id="order.id" />

                </section>

                <!-- Email -->
                <section class="mt-4">

                    <confirmationEmail :email="order.email" />

                </section>

            </template>

        </div>

    </main>
    <Footer />

</template>

<script setup>
import { watch } from "vue";
import { RouterLink } from "vue-router";

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

import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";

import { useOrderSuccess } from "@/composables/useOrderSuccess";
import { focusHeadingAfterLoad } from "@/router/pageFocus";

const {
    order,
    loading,
    error,
    productCount,
    totalQuantity,
    load,
} = useOrderSuccess();

// The success (or "Order unavailable") heading appears once loading ends.
watch(loading, (isLoading) => { if (!isLoading) focusHeadingAfterLoad(); });

</script>
