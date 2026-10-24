<template>
    <Header />

    <main id="main-content" tabindex="-1" class="bg-surface">

        <div class="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:px-8">

            <!-- Announces quantity changes and removals (outside the v-if branches so it persists). -->
            <p role="status" class="sr-only">{{ announcement }}</p>

            <!-- Guest items the server rejected while merging after login -->
            <section v-if="cart.mergeIssues.length"
                class="mb-6 rounded-card border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <p class="font-semibold">Some items from your guest cart could not be added:</p>
                <ul class="mt-2 list-disc space-y-1 pl-5">
                    <li v-for="issue in cart.mergeIssues" :key="issue.variantId">
                        {{ issue.name }} &times; {{ issue.quantity }} &mdash; {{ issue.message }}
                    </li>
                </ul>
                <div class="mt-3 flex gap-2 font-semibold">
                    <button type="button" :class="TEXT_BUTTON" :disabled="cart.loading" @click="cart.retryMerge()">
                        Try again
                    </button>
                    <button type="button" :class="[TEXT_BUTTON, 'text-slate-600 hover:text-slate-900']"
                        @click="cart.dismissMergeIssues()">
                        Dismiss
                    </button>
                </div>
            </section>

            <!-- Initial Load -->
            <section v-if="cart.loading && !products.length"
                class="flex min-h-96 items-center justify-center rounded-panel bg-white">
                <LoadingSpinner class="text-brand" label="Loading your cart" />
            </section>

            <!-- Load Error (nothing to show yet) -->
            <section v-else-if="cart.error && !products.length"
                class="flex min-h-96 flex-col items-center justify-center rounded-panel bg-white px-6 text-center">
                <ExclamationTriangleIcon class="h-8 w-8 text-slate-400" aria-hidden="true" />
                <h1 class="mt-4 text-lg font-semibold text-slate-900">Could not load your cart</h1>
                <p class="mt-2 text-sm text-slate-600">{{ cart.error }}</p>
                <PrimaryButton tag="button" class="mt-6" @click="cart.loadCart()">
                    Try again
                </PrimaryButton>
            </section>

            <!-- Empty Cart (guests are offered their saved account cart) -->
            <template v-else-if="!products.length">
                <emptyCart />
                <p v-if="!auth.isAuthenticated" class="mt-4 text-center text-sm text-slate-600">
                    <RouterLink :to="{ name: 'login', query: { redirect: '/cart' } }"
                        class="rounded-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Sign in</RouterLink>
                    to see the items saved to your account.
                </p>
            </template>

            <!-- Cart -->
            <template v-else>

                <cartHero :item-count="cart.itemCount" />

                <div class="mt-6 grid items-start gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">

                    <!-- Items -->

                    <section class="min-w-0" aria-labelledby="cart-items-heading">

                        <h2 id="cart-items-heading" class="sr-only">Items in your cart</h2>

                        <p v-if="cart.error" role="alert"
                            class="mb-4 flex items-start gap-2 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                            <ExclamationCircleIcon class="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                            {{ cart.error }}
                        </p>

                        <cartList :class="{ 'pointer-events-none opacity-60': cart.updating }" :aria-busy="cart.updating || undefined"
                            :products="products" @update-quantity="updateQuantity" @remove-product="removeProduct" />

                        <div class="mt-5 flex flex-wrap items-center justify-between gap-3">

                            <continueShopping />

                            <button v-if="!confirmingClear" id="clear-cart-button" type="button" :disabled="cart.updating"
                                :class="[TEXT_BUTTON, 'text-red-700 hover:text-red-800']" @click="askClear">
                                <TrashIcon class="h-5 w-5" aria-hidden="true" />
                                Clear Cart
                            </button>

                        </div>

                        <!-- Clear confirmation (same pattern as deleting a saved address) -->
                        <div v-if="confirmingClear" role="alertdialog" aria-labelledby="clear-cart-title"
                            aria-describedby="clear-cart-note" class="mt-4 rounded-card border border-red-200 bg-red-50 p-4">
                            <p id="clear-cart-title" class="font-semibold text-slate-900">Remove all items from your cart?</p>
                            <p id="clear-cart-note" class="mt-1 text-sm text-slate-600">
                                {{ cart.itemCount }} {{ cart.itemCount === 1 ? "item" : "items" }} will be removed. This can't be undone.
                            </p>
                            <div class="mt-3 flex flex-wrap gap-3">
                                <PrimaryButton tag="button" variant="danger" :loading="cart.updating" @click="clearCart">
                                    Clear cart
                                </PrimaryButton>
                                <PrimaryButton id="keep-cart-button" tag="button" variant="outline"
                                    :disabled="cart.updating" @click="cancelClear">
                                    Keep items
                                </PrimaryButton>
                            </div>
                        </div>

                    </section>

                    <!-- Summary -->

                    <aside class="min-w-0 lg:sticky lg:top-24">

                        <!-- Shipping and tax are priced by the server at checkout -->
                        <orderSummary :subtotal="cart.subtotal" :currency="cart.currency"
                            :mixed-currency="cart.mixedCurrency" :blocked-reason="blockedReason" />

                    </aside>

                </div>

            </template>

        </div>

    </main>

    <Footer />
</template>

<script setup>
import Header from "../components/layout/Header/Header.vue";
import Footer from "../components/layout/Footer/Footer.vue";

import cartHero from "@/components/cart/hero/cartHero.vue";

import cartList from "@/components/cart/list/cartList.vue";

import orderSummary from "@/components/cart/summary/orderSummary.vue";

import continueShopping from "@/components/cart/continueShopping.vue";

import emptyCart from "@/components/cart/empty/emptyCart.vue";

import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";

import { computed, nextTick, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { ExclamationCircleIcon, ExclamationTriangleIcon, TrashIcon } from "@heroicons/vue/24/outline";

import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { focusMainContent } from "@/router/pageFocus";

const TEXT_BUTTON = "inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-semibold text-brand transition-colors hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

const auth = useAuthStore();
const cart = useCartStore();

// Maps a cart item to the shape the existing cart components render.
// `id` is the cart item id (the variant id for guests), which the
// update/remove events send back.
function toCartProduct(item) {
    return {
        id: item.id,
        variantId: item.variant.id,
        productId: item.product.id,
        name: item.product.name,
        title: item.product.alt,
        image: item.product.image,
        brand: item.product.brand,
        color: item.variant.color,
        size: item.variant.size,
        stock: item.variant.stock,
        isAvailable: item.isAvailable,
        quantity: item.quantity,
        price: item.unitPrice,
        originalPrice: item.originalPrice,
        subtotal: item.subtotal,
        currency: item.product.currency,
    };
}

const products = computed(() => cart.items.map(toCartProduct));

// Why checkout cannot start from this cart, or "" when it can. Only states the
// client knows exactly as the server does: one currency per cart (both enforce
// it), and a signed-in cart's isAvailable, which the server computed. A guest's
// availability is a catalog courtesy check, so it never blocks: the server
// decides when the cart is merged at sign-in.
const blockedReason = computed(() => {
    if (cart.mixedCurrency) return "Your cart has items in different currencies. Remove the items in one currency to check out.";

    if (auth.isAuthenticated && products.value.some((product) => product.isAvailable === false)) {
        return "Some items are unavailable or exceed the stock left. Update or remove them to check out.";
    }

    return "";
});

// Re-sync on every visit; stock or prices may have changed since the last load.
// Guests get fresh catalog data for their stored items.
onMounted(() => {
    cart.loadCart();
});

/*
|--------------------------------------------------------------------------
| Cart Actions
|--------------------------------------------------------------------------
| Failures are shown through cart.error; the cart state stays as the server
| last returned it.
*/

const ignore = () => {};

const announcement = ref("");

// Cleared first so repeating the same change is announced again.
async function announce(text) {
    announcement.value = "";
    await nextTick();
    announcement.value = text;
}

const nameOf = (itemId) => products.value.find((product) => product.id === itemId)?.name ?? "Item";

// The pressed button is gone once its item is removed; keep keyboard users on the page.
async function keepFocus() {
    await nextTick();
    if (!document.activeElement || document.activeElement === document.body) focusMainContent();
}

function updateQuantity({ productId, quantity }) {
    const name = nameOf(productId);

    cart.updateItem(productId, quantity)
        .then(() => announce(`Quantity for ${name} updated to ${quantity}`))
        .catch(ignore);
}

function removeProduct(itemId) {
    const name = nameOf(itemId);

    cart.removeItem(itemId)
        .then(() => {
            announce(`${name} removed from your cart`);
            keepFocus();
        })
        .catch(ignore);
}

// Clear Cart asks first; focus starts on the safe choice and returns to Clear Cart on cancel.
const confirmingClear = ref(false);

async function askClear() {
    confirmingClear.value = true;
    await nextTick();
    document.getElementById("keep-cart-button")?.focus();
}

async function cancelClear() {
    confirmingClear.value = false;
    await nextTick();
    document.getElementById("clear-cart-button")?.focus();
}

function clearCart() {
    cart.clearCart()
        .then(() => {
            confirmingClear.value = false;
            announce("Your cart is now empty");
            keepFocus();
        })
        .catch(ignore);
}
</script>
