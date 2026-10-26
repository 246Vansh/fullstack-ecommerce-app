<template>
    <Header />

    <main id="main-content" tabindex="-1" class="bg-surface">

        <div class="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:px-8" :class="{ 'pb-28 lg:pb-16': showStickyBar }">

            <!-- Initial Load (also the first render, before the request starts) -->
            <section v-if="!checkout && !error"
                class="flex min-h-96 items-center justify-center rounded-panel bg-white">
                <LoadingSpinner class="text-brand" label="Loading checkout" />
            </section>

            <!-- Load Error (nothing to show yet) -->
            <section v-else-if="error && !checkout"
                class="flex min-h-96 flex-col items-center justify-center rounded-panel bg-white px-6 text-center">
                <ExclamationTriangleIcon class="h-8 w-8 text-slate-400" aria-hidden="true" />
                <h1 class="mt-4 text-lg font-semibold text-slate-900">Could not load checkout</h1>
                <p class="mt-2 text-sm text-slate-600">{{ error }}</p>
                <PrimaryButton tag="button" class="mt-6" @click="load()">
                    Try again
                </PrimaryButton>
            </section>

            <!-- Empty Cart: no order summary, nothing to proceed with -->
            <section v-else-if="validation?.isEmpty"
                class="flex min-h-96 flex-col items-center justify-center rounded-panel bg-white px-6 text-center">
                <span class="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <ShoppingBagIcon class="h-8 w-8" aria-hidden="true" />
                </span>
                <h1 class="mt-6 text-2xl font-semibold tracking-tight text-slate-900">Your cart is empty</h1>
                <p class="mt-2 text-slate-600">Add some items to your cart before checking out.</p>
                <div class="mt-8 flex flex-wrap justify-center gap-3">
                    <PrimaryButton to="/products">Continue Shopping</PrimaryButton>
                    <PrimaryButton to="/cart" variant="outline">View Cart</PrimaryButton>
                </div>
            </section>

            <template v-else>

                <checkoutHero />

                <div class="mt-6 grid items-start gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">

                    <!-- LEFT COLUMN -->
                    <section class="min-w-0 space-y-5" aria-label="Checkout details">

                        <!-- Refresh error while data is already shown -->
                        <p v-if="error" role="alert"
                            class="flex items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                            <ExclamationCircleIcon class="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                            {{ error }}
                        </p>

                        <!-- Items the server says need attention; the cart is not changed for the user -->
                        <section v-if="validation?.issues.length" id="checkout-issues" role="alert"
                            class="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
                            <p class="font-semibold">Some items in your cart need attention before you can check out:</p>
                            <ul class="mt-2 list-disc space-y-1 pl-5">
                                <li v-for="issue in issueList" :key="issue.cartItemId">
                                    {{ issue.name }} &mdash; {{ issue.message }}
                                </li>
                            </ul>
                            <RouterLink to="/cart"
                                class="mt-3 inline-flex min-h-11 items-center rounded-sm font-semibold text-brand underline underline-offset-4 hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                                Update your cart
                            </RouterLink>
                        </section>

                        <contactCard :customer="auth.user" />

                        <shippingCard :addresses="addresses" :selected-id="selectedAddressId" :save="saveAddress" :remove="deleteAddress"
                            :disabled="placing" @select="selectAddress" />

                        <!-- Delivery methods, coupons and order notes are not implemented, so they are not shown. -->
                        <paymentCard v-model="paymentMethod" :methods="paymentMethods" :disabled="placing" />

                    </section>

                    <!-- RIGHT COLUMN -->
                    <!-- top-24: clears the sticky header (h-16 + border) with a 2rem gap. -->
                    <aside class="min-w-0 transition-opacity lg:sticky lg:top-24" :class="{ 'opacity-60': loading }"
                        :aria-busy="loading || undefined">

                        <orderSummary :products="products" :subtotal="summary.subtotal" :discount="summary.discount"
                            :shipping="summary.shipping" :tax="summary.tax" :total="summary.total" :currency="summary.currency"
                            :customer="auth.user"
                            :address="selectedAddress" :can-proceed="validation.canProceed && !loading" :placing="placing"
                            :payment-method="paymentMethod" :blocked-reason="blockedReason" :place-error="placeError"
                            @place-order="placeOrder(paymentMethod)" />

                    </aside>

                </div>

            </template>

        </div>

        <!-- Mobile/tablet bar while the summary's Place Order is off screen. Same
             handler (useCheckout ignores a second call while one is in flight). It
             lives outside <main> in a "Quick checkout" landmark, so the summary's
             button and this one are told apart by region. -->
        <Teleport to="body">
            <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="translate-y-full"
                enter-to-class="translate-y-0" leave-active-class="transition duration-150 ease-in"
                leave-from-class="translate-y-0" leave-to-class="translate-y-full">

                <section v-if="showStickyBar" aria-label="Quick checkout"
                    class="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-raised backdrop-blur-md sm:px-6 lg:hidden">

                    <div class="mx-auto flex max-w-7xl items-center gap-4">

                        <div class="min-w-0 flex-1">
                            <p class="text-xs text-slate-500">Total</p>
                            <p class="text-lg font-semibold tracking-tight text-slate-900">
                                {{ formatPrice(summary.total, summary.currency) }}
                            </p>
                        </div>

                        <PrimaryButton tag="button" class="shrink-0" :disabled="!(validation.canProceed && !loading)"
                            :loading="placing" @click="placeOrder(paymentMethod)">
                            {{ placing ? "Processing…" : placeLabel }}
                        </PrimaryButton>

                    </div>

                    <!-- Visual copies only: the summary's alert already announces the error. -->
                    <p v-if="placeError && !placing" aria-hidden="true" class="mx-auto mt-1 max-w-7xl text-xs font-medium text-red-700">
                        {{ placeError }}
                    </p>

                    <p v-else-if="blockedReason" class="mx-auto mt-1 max-w-7xl text-xs font-medium text-amber-800">
                        {{ blockedReason }}
                    </p>

                </section>

            </Transition>
        </Teleport>

    </main>

    <Footer />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { ExclamationCircleIcon, ExclamationTriangleIcon, ShoppingBagIcon } from "@heroicons/vue/24/outline";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";

import checkoutHero from "@/components/checkout/hero/checkoutHero.vue";

import contactCard from "@/components/checkout/contact/contactCard.vue";
import shippingCard from "@/components/checkout/address/shippingCard.vue";
import paymentCard from "@/components/checkout/payment/paymentCard.vue";

import orderSummary from "@/components/checkout/summary/orderSummary.vue";

import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";

import { useAuthStore } from "@/stores/authStore";
import { useCheckout } from "@/composables/useCheckout";
import { formatPrice } from "@/utils/money";
import { placeOrderLabel } from "@/components/checkout/summary/placeOrderLabel";

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
    deleteAddress,
    placing,
    placeError,
    placeOrder,
} = useCheckout();

// Server checkout items in the shape the summary components render.
const products = computed(() => items.value.map((item) => ({
    id: item.id,
    productId: item.product.id,
    name: item.product.name,
    image: item.product.image,
    color: item.variant.color,
    size: item.variant.size,
    quantity: item.quantity,
    price: item.unitPrice,
    subtotal: item.subtotal,
    currency: item.product.currency,
    issue: item.issue,
})));

const issueList = computed(() => validation.value.issues.map((issue) => {
    const item = items.value.find((entry) => entry.id === issue.cartItemId);
    const options = [item?.variant.color, item?.variant.size].filter(Boolean).join(" / ");

    return { ...issue, name: options ? `${item.product.name} (${options})` : item?.product.name };
}));

// The methods the server offers; COD stays available when online payment is off.
const paymentMethods = computed(() => checkout.value?.paymentMethods ?? ["COD"]);
const paymentMethod = ref("COD");

// Never keep a method the server no longer offers.
watch(paymentMethods, (methods) => {
    if (!methods.includes(paymentMethod.value)) paymentMethod.value = methods[0] ?? "COD";
});

const placeLabel = computed(() => placeOrderLabel(paymentMethod.value));

// Why Place Order is disabled, read from the server's validation (no new rules):
// canProceed = the cart is valid and an address is selected.
const blockedReason = computed(() => {
    const result = validation.value;

    if (!result || result.canProceed) return loading.value ? "Updating your order totals…" : "";
    if (result.issues?.length) return "Some items in your cart need attention. See the list above.";
    if (!result.hasAddress) return "Add or select a shipping address to continue.";

    return "Your order can't be placed yet. Please review your cart.";
});

onMounted(() => load());

// ==================================================
// Mobile/tablet Place Order bar
// ==================================================

// Shown below lg while the summary's Place Order button is outside the
// viewport (on phones the summary sits after the form), and never over the
// footer. Measured on scroll, like the product page's purchase bar.
const showStickyBar = ref(false);

let frame = 0;

function updateStickyBar() {
    frame = 0;

    const button = document.getElementById("place-order-button");
    const footer = document.querySelector("footer");

    if (!button || window.innerWidth >= 1024) {
        showStickyBar.value = false;
        return;
    }

    const rect = button.getBoundingClientRect();
    const offscreen = rect.top > window.innerHeight || rect.bottom < 0;
    const footerVisible = Boolean(footer) && footer.getBoundingClientRect().top < window.innerHeight;

    showStickyBar.value = offscreen && !footerVisible;
}

function onScroll() {
    if (!frame) frame = requestAnimationFrame(updateStickyBar);
}

onMounted(() => {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
});

// The summary (and its button) appears once checkout data arrives.
watch(checkout, onScroll, { flush: "post" });

onBeforeUnmount(() => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);

    if (frame) cancelAnimationFrame(frame);
});
</script>
