<template>
    <Header />

    <main class="bg-slate-50">

        <div class="mx-auto max-w-[1850px] px-2 py-2">

            <!-- Empty Cart -->
            <emptyCart v-if="!products.length" />

            <!-- Cart -->
            <template v-else>

                <!-- ===================================================== -->
                <!-- MAIN CONTAINER -->
                <!-- ===================================================== -->

                <section class="overflow-hidden rounded-4xl border border-gray-200 bg-white shadow-sm">

                    <!-- Hero -->

                    <cartHero :item-count="products.length" />

                    <!-- Content -->

                    <div class="grid border-t border-gray-200 xl:grid-cols-[minmax(0,1fr)_520px]">

                        <!-- LEFT -->

                        <section class="p-8">

                            <shippingBanner :is-free-shipping="shipping === 0" :remaining-amount="remainingAmount"
                                :progress="shippingProgress" />

                            <cartList class="mt-5" :products="products" @update-quantity="updateQuantity"
                                @remove-product="removeProduct" />

                            <continueShopping class="mt-6" />

                        </section>

                        <!-- RIGHT -->

                        <aside class="bg-white p-8">

                            <div class="sticky top-8">

                                <orderSummary :subtotal="subtotal" :discount="discount" :shipping="shipping" :tax="tax"
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

import { useCart } from "@/composables/useCart";

const { products, subtotal, discount, shipping, tax, total, updateQuantity, removeProduct } = useCart();
/*
|--------------------------------------------------------------------------
| Temporary values
|--------------------------------------------------------------------------
| These will come from backend later
*/

const suggestedProducts = [];

const remainingAmount = 18;

const shippingProgress = 75;

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