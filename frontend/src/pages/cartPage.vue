<template>
    <Header />

    <main class="bg-slate-50">

        <div class="mx-auto max-w-[1850px] px-2 py-2">

            <!-- Initial Load -->
            <section v-if="cart.loading && !products.length"
                class="flex min-h-100 items-center justify-center rounded-4xl border border-dashed border-gray-300 bg-white">
                <LoadingSpinner class="text-gray-400" />
            </section>

            <!-- Load Error (nothing to show yet) -->
            <section v-else-if="cart.error && !products.length"
                class="flex min-h-100 flex-col items-center justify-center rounded-4xl border border-dashed border-gray-300 bg-white text-center">
                <h2 class="text-lg font-semibold text-gray-900">Could not load your cart</h2>
                <p class="mt-2 text-sm text-gray-500">{{ cart.error }}</p>
                <button type="button" class="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500 cursor-pointer"
                    @click="cart.loadCart()">
                    Try again
                </button>
            </section>

            <!-- Empty Cart (guests have no cart yet and are asked to sign in) -->
            <template v-else-if="!products.length">
                <emptyCart />
                <p v-if="!auth.isAuthenticated" class="mt-4 text-center text-sm text-gray-500">
                    <RouterLink :to="{ name: 'login', query: { redirect: '/cart' } }"
                        class="font-medium text-indigo-600 hover:text-indigo-500">Sign in</RouterLink>
                    to see the items in your cart.
                </p>
            </template>

            <!-- Cart -->
            <template v-else>

                <!-- ===================================================== -->
                <!-- MAIN CONTAINER -->
                <!-- ===================================================== -->

                <section class="overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-sm">

                    <!-- Hero -->

                    <cartHero :item-count="cart.itemCount" />

                    <!-- Content -->

                    <div class="grid border-t border-gray-200 xl:grid-cols-[minmax(0,1fr)_520px]">

                        <!-- LEFT -->

                        <section class="p-8">

                            <shippingBanner :is-free-shipping="shipping === 0" :remaining-amount="remainingAmount"
                                :progress="shippingProgress" />

                            <p v-if="cart.error" class="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                {{ cart.error }}
                            </p>

                            <cartList class="mt-5" :class="{ 'pointer-events-none opacity-60': cart.updating }"
                                :products="products" @update-quantity="updateQuantity" @remove-product="removeProduct" />

                            <div class="flex items-center justify-between">

                                <continueShopping class="mt-6" />

                                <button type="button" :disabled="cart.updating"
                                    class="mt-6 flex items-center gap-2 font-medium text-red-500 transition hover:text-red-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    @click="clearCart">
                                    <TrashIcon class="h-5 w-5" />
                                    Clear Cart
                                </button>

                            </div>

                        </section>

                        <!-- RIGHT -->

                        <aside class="bg-white p-8">

                            <div class="sticky top-8">

                                <orderSummary :subtotal="cart.subtotal" :discount="0" :shipping="shipping" :tax="tax"
                                    :total="total" @checkout="checkout" />

                                <paymentMethods class="mt-5" />

                            </div>

                        </aside>

                    </div>

                    <!-- Divider -->

                    <div class="mx-8 border-t border-gray-200">
                    </div>

                    <!-- Recommendations -->

                    <recommendedProducts class="px-8 py-8" :products="products" @add-to-cart="addToCart"
                        @toggle-wishlist="toggleWishlist" />

                </section>

            </template>

        </div>

    </main>

    <Footer />
</template>

<script setup>
import Header from "../components/layout/Header/Header.vue";
import Footer from "../components/layout/Footer/Footer.vue";

import cartHero from "@/components/cart/hero/cartHero.vue";
import shippingBanner from "@/components/cart/banner/shippingBanner.vue";

import cartList from "@/components/cart/list/cartList.vue";

import orderSummary from "@/components/cart/summary/orderSummary.vue";

import paymentMethods from "../components/cart/summary/paymentMethods.vue";

import continueShopping from "@/components/cart/continueShopping.vue";

import recommendedProducts from "@/components/cart/recommendations/recommendedProducts.vue";

import emptyCart from "@/components/cart/empty/emptyCart.vue";

import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";

import { computed, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { TrashIcon } from "@heroicons/vue/24/outline";

import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";

const auth = useAuthStore();
const cart = useCartStore();

// Maps a server cart item to the shape the existing cart components render.
// `id` is the cart item id, which the update/remove events send back.
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
        quantity: item.quantity,
        price: item.unitPrice,
        originalPrice: item.originalPrice,
        subtotal: item.subtotal,
        rating: 0,
        reviewCount: 0,
    };
}

const products = computed(() => cart.items.map(toCartProduct));

// Re-sync on every visit; stock or prices may have changed since the last load.
onMounted(() => {
    if (auth.isAuthenticated) cart.loadCart();
});

/*
|--------------------------------------------------------------------------
| Estimates
|--------------------------------------------------------------------------
| Shipping and tax are display estimates derived from the server subtotal;
| the API has no shipping/tax yet, and checkout will price the final order.
*/

const FREE_SHIPPING_THRESHOLD = 100;

const TAX_RATE = 0.08;

const shipping = computed(() => (cart.subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : 5));

const tax = computed(() => Math.round(cart.subtotal * TAX_RATE * 100) / 100);

const total = computed(() => cart.subtotal + shipping.value + tax.value);

const remainingAmount = computed(() =>
    Math.max(0, Math.round((FREE_SHIPPING_THRESHOLD - cart.subtotal) * 100) / 100)
);

const shippingProgress = computed(() => Math.min(100, (cart.subtotal / FREE_SHIPPING_THRESHOLD) * 100));

/*
|--------------------------------------------------------------------------
| Cart Actions
|--------------------------------------------------------------------------
| Failures are shown through cart.error; the cart state stays as the server
| last returned it.
*/

const ignore = () => {};

function updateQuantity({ productId, quantity }) {
    cart.updateItem(productId, quantity).catch(ignore);
}

function removeProduct(itemId) {
    cart.removeItem(itemId).catch(ignore);
}

function clearCart() {
    cart.clearCart().catch(ignore);
}

function addToCart(product) {
    cart.addItem(product.variantId, 1).catch(ignore);
}

/*
|--------------------------------------------------------------------------
| Events
|--------------------------------------------------------------------------
*/

function checkout() {

    console.log("Proceed to checkout");

}

function toggleWishlist(product) {

    console.log(product);

}
</script>