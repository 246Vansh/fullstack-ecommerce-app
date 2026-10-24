<template>

    <Header />

    <main id="main-content" tabindex="-1" class="bg-surface">

        <div class="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:px-8">

            <!-- Loading -->
            <section v-if="loading && !order"
                class="flex min-h-96 items-center justify-center rounded-panel bg-white">
                <LoadingSpinner class="text-brand" label="Loading your order" />
            </section>

            <!-- Error: never fall back to placeholder order data -->
            <section v-else-if="!order"
                class="flex min-h-96 flex-col items-center justify-center rounded-panel bg-white px-6 text-center">
                <ExclamationTriangleIcon class="h-8 w-8 text-slate-400" aria-hidden="true" />
                <h1 class="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Order unavailable</h1>
                <p class="mt-2 text-slate-600">{{ error }}</p>
                <div class="mt-8 flex flex-wrap justify-center gap-3">
                    <PrimaryButton tag="button" variant="outline" @click="load()">
                        Try again
                    </PrimaryButton>
                    <PrimaryButton to="/products">
                        Continue Shopping
                    </PrimaryButton>
                </div>
            </section>

            <template v-else>

                <!-- Confirmation step only once the order is really confirmed (not cancelled or awaiting payment). -->
                <checkoutProgress v-if="confirmed" class="mb-5" current-step="confirmation" />

                <!-- Hero: state, order reference, statuses. An online order that has not
                     been paid is never shown as complete: its heading (focused on load) says
                     it is waiting for payment, and the first action becomes "Pay for this order". -->
                <successHero :order="order" :product-count="productCount" :total-quantity="totalQuantity" />

                <!-- Next steps -->
                <actionButtons class="mt-5" :order-id="order.id" :payable="order.payable" />

                <div class="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">

                    <!-- Items -->
                    <purchasedProducts :products="order.items" :currency="order.currency" />

                    <!-- Payment + Shipping -->
                    <div class="space-y-5">

                        <paymentCard :order="order" />

                        <shippingCard :address="order.shippingAddress" />

                        <confirmationEmail :email="order.email" />

                    </div>

                </div>

            </template>

        </div>

    </main>
    <Footer />

</template>

<script setup>
import { computed, watch } from "vue";
import { ExclamationTriangleIcon } from "@heroicons/vue/24/outline";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";

import successHero from "@/components/orderSuccess/hero/successHero.vue";

import shippingCard from "@/components/orderSuccess/details/shippingCard.vue";
import purchasedProducts from "@/components/orderSuccess/details/purchasedProducts.vue";
import paymentCard from "@/components/orderSuccess/details/paymentCard.vue";

import actionButtons from "@/components/orderSuccess/actions/actionButtons.vue";
import confirmationEmail from "@/components/orderSuccess/actions/confirmationEmail.vue";

import checkoutProgress from "@/components/checkout/progress/checkoutProgress.vue";

import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";

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

// Cash on delivery, or an online order the server has verified as paid.
const confirmed = computed(() => Boolean(order.value)
    && order.value.status !== "CANCELLED"
    && (order.value.paymentMethod !== "RAZORPAY" || order.value.paymentStatus === "PAID"));

// The success (or "Order unavailable") heading appears once loading ends.
watch(loading, (isLoading) => { if (!isLoading) focusHeadingAfterLoad(); });

</script>
