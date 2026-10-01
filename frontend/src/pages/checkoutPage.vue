<template>
    <Header />

    <main class="bg-slate-50">

        <div class="mx-auto max-w-[1850px] px-4 py-6 sm:px-8 sm:py-8">

            <!-- Initial Load (also the first render, before the request starts) -->
            <section v-if="!checkout && !error"
                class="flex min-h-100 items-center justify-center rounded-4xl border border-dashed border-gray-300 bg-white">
                <LoadingSpinner class="text-gray-400" />
            </section>

            <!-- Load Error (nothing to show yet) -->
            <section v-else-if="error && !checkout"
                class="flex min-h-100 flex-col items-center justify-center rounded-4xl border border-dashed border-gray-300 bg-white text-center">
                <h2 class="text-lg font-semibold text-gray-900">Could not load checkout</h2>
                <p class="mt-2 text-sm text-gray-500">{{ error }}</p>
                <button type="button" class="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500 cursor-pointer"
                    @click="load()">
                    Try again
                </button>
            </section>

            <!-- Empty Cart: no order summary, nothing to proceed with -->
            <section v-else-if="validation?.isEmpty"
                class="flex min-h-100 flex-col items-center justify-center rounded-4xl border border-dashed border-gray-300 bg-white text-center">
                <h2 class="text-2xl font-bold text-gray-900">Your cart is empty</h2>
                <p class="mt-2 text-gray-500">Add some items to your cart before checking out.</p>
                <div class="mt-6 flex gap-4">
                    <RouterLink to="/products"
                        class="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">
                        Continue Shopping
                    </RouterLink>
                    <RouterLink to="/cart"
                        class="rounded-xl border border-gray-200 px-6 py-3 font-semibold text-slate-700 hover:bg-gray-50">
                        View Cart
                    </RouterLink>
                </div>
            </section>

            <div v-else class="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_470px]">

                <!-- LEFT COLUMN -->
                <section class="min-w-0 space-y-6">

                    <checkoutHero />

                    <!-- Refresh error while data is already shown -->
                    <p v-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {{ error }}
                    </p>

                    <!-- Items the server says need attention; the cart is not changed for the user -->
                    <section v-if="validation?.issues.length"
                        class="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-800">
                        <p class="font-semibold">Some items in your cart need attention before you can check out:</p>
                        <ul class="mt-2 list-disc space-y-1 pl-5">
                            <li v-for="issue in issueList" :key="issue.cartItemId">
                                {{ issue.name }} &mdash; {{ issue.message }}
                            </li>
                        </ul>
                        <RouterLink to="/cart" class="mt-3 inline-block font-medium text-indigo-600 hover:text-indigo-500">
                            Update your cart
                        </RouterLink>
                    </section>

                    <contactCard :customer="auth.user" />

                    <shippingCard :addresses="addresses" :selected-id="selectedAddressId" :save="saveAddress"
                        @select="selectAddress" />

                    <!-- Delivery methods, coupons and order notes are not implemented, so they are not shown. -->
                    <paymentCard />

                </section>

                <!-- RIGHT COLUMN -->
                <aside class="sticky top-8 min-w-0" :class="{ 'opacity-60': loading }">

                    <orderSummary :products="products" :subtotal="summary.subtotal" :discount="summary.discount"
                        :shipping="summary.shipping" :tax="summary.tax" :total="summary.total" :customer="auth.user"
                        :address="selectedAddress" :can-proceed="validation.canProceed && !loading" :placing="placing"
                        @place-order="placeOrder" />

                    <p v-if="placeError" role="alert"
                        class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {{ placeError }}
                    </p>

                </aside>

            </div>

        </div>

    </main>

    <Footer />
</template>

<script setup>
import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";

import checkoutHero from "@/components/checkout/hero/checkoutHero.vue";

import contactCard from "@/components/checkout/contact/contactCard.vue";
import shippingCard from "@/components/checkout/address/shippingCard.vue";
import paymentCard from "@/components/checkout/payment/paymentCard.vue";

import orderSummary from "@/components/checkout/summary/orderSummary.vue";

import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";

import { useAuthStore } from "@/stores/authStore";
import { useCheckout } from "@/composables/useCheckout";

// The route requires auth (router meta), so only signed-in users get here.
const auth = useAuthStore();

const {
    checkout,
    items,
    summary,
    addresses,
    validation,
    selectedAddressId,
    selectedAddress,
    loading,
    error,
    load,
    selectAddress,
    saveAddress,
    placing,
    placeError,
    placeOrder,
} = useCheckout();

// Server checkout items in the shape the summary components render.
const products = computed(() => items.value.map((item) => ({
    id: item.id,
    name: item.product.name,
    image: item.product.image,
    color: item.variant.color,
    size: item.variant.size,
    quantity: item.quantity,
    price: item.unitPrice,
    subtotal: item.subtotal,
    issue: item.issue,
})));

const issueList = computed(() => validation.value.issues.map((issue) => {
    const item = items.value.find((entry) => entry.id === issue.cartItemId);
    const options = [item?.variant.color, item?.variant.size].filter(Boolean).join(" / ");

    return { ...issue, name: options ? `${item.product.name} (${options})` : item?.product.name };
}));

onMounted(() => load());
</script>
