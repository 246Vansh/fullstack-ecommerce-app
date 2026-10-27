<template>

    <Header />

    <main id="main-content" tabindex="-1" class="bg-surface">

        <div class="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:px-8">

            <header class="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">Wishlist</h1>
                    <p v-if="wishlist.loaded && wishlist.items.length" class="mt-1 text-sm text-slate-600">
                        {{ wishlist.items.length }} saved {{ wishlist.items.length === 1 ? "product" : "products" }}
                    </p>
                </div>
            </header>

            <!-- Always rendered so screen readers announce each new message. -->
            <p role="status" class="text-sm font-medium text-brand" :class="{ 'mt-4': status }">{{ status }}</p>

            <!-- A failed reload keeps the list already shown. -->
            <div v-if="wishlist.error && wishlist.loaded" role="alert"
                class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {{ wishlist.error }}
                <PrimaryButton tag="button" variant="outline" size="sm" @click="reload">Try again</PrimaryButton>
            </div>

            <!-- Loading -->
            <section v-if="!wishlist.loaded && wishlist.loading"
                class="mt-6 flex min-h-80 items-center justify-center rounded-panel border border-slate-200 bg-white">
                <LoadingSpinner class="text-brand" label="Loading wishlist" />
            </section>

            <!-- Error with nothing loaded -->
            <section v-else-if="!wishlist.loaded"
                class="mt-6 flex min-h-80 flex-col items-center justify-center rounded-panel border border-slate-200 bg-white px-6 text-center">
                <ExclamationTriangleIcon class="h-8 w-8 text-slate-400" aria-hidden="true" />
                <h2 class="mt-4 text-xl font-semibold text-slate-900">We couldn't load your wishlist</h2>
                <p class="mt-2 text-slate-600">{{ wishlist.error }}</p>
                <PrimaryButton tag="button" variant="outline" class="mt-6" @click="reload">Try again</PrimaryButton>
            </section>

            <!-- Empty -->
            <section v-else-if="!wishlist.items.length"
                class="mt-6 flex min-h-80 flex-col items-center justify-center rounded-panel border border-slate-200 bg-white px-6 text-center">
                <HeartIcon class="h-10 w-10 text-slate-300" aria-hidden="true" />
                <h2 class="mt-4 text-xl font-semibold text-slate-900">Your wishlist is empty</h2>
                <p class="mt-2 max-w-sm text-slate-600">Tap the heart on any product to save it here for later.</p>
                <PrimaryButton :to="ROUTES.PRODUCTS" class="mt-6">Browse products</PrimaryButton>
            </section>

            <!-- Saved products -->
            <ul v-else class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                <li v-for="product in wishlist.items" :key="product.id"
                    class="flex gap-4 rounded-panel border border-slate-200 bg-white p-4">

                    <RouterLink :to="{ name: 'product-details', params: { id: product.id } }" tabindex="-1" aria-hidden="true"
                        class="w-24 shrink-0 sm:w-28">
                        <ProductImage :src="product.image" alt="" sizes="112px"
                            :class="product.inStock ? '' : 'opacity-70 grayscale-[30%]'" />
                    </RouterLink>

                    <div class="flex min-w-0 flex-1 flex-col">

                        <p v-if="product.brand" class="text-xs font-medium uppercase tracking-wide text-slate-500">{{ product.brand }}</p>
                        <RouterLink :to="{ name: 'product-details', params: { id: product.id } }"
                            class="rounded-sm text-sm font-semibold leading-snug text-slate-900 wrap-anywhere hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-base">
                            {{ product.name }}
                        </RouterLink>

                        <ProductPrice class="mt-1" :price="product.price" :original-price="product.originalPrice" :currency="product.currency" />

                        <p class="mt-1 flex items-center gap-1.5 text-xs font-medium"
                            :class="product.inStock ? 'text-brand' : 'text-slate-500'">
                            <span class="h-1.5 w-1.5 rounded-full" :class="product.inStock ? 'bg-brand' : 'bg-slate-400'" aria-hidden="true" />
                            {{ product.inStock ? "In stock" : "Sold out" }}
                        </p>

                        <div class="mt-auto flex flex-wrap items-center gap-2 pt-3">

                            <!-- One variant: straight to the cart. Several: choose size/color first. -->
                            <PrimaryButton v-if="canAddDirectly(product)" tag="button" size="sm"
                                :loading="adding.has(product.id)" :disabled="adding.has(product.id)" @click="addToCart(product)">
                                <ShoppingBagIcon v-if="!adding.has(product.id)" class="h-4 w-4" aria-hidden="true" />
                                Add to cart
                            </PrimaryButton>
                            <PrimaryButton v-else-if="product.inStock" size="sm" variant="outline"
                                :to="{ name: 'product-details', params: { id: product.id } }">
                                Choose options
                            </PrimaryButton>

                            <button type="button" :disabled="wishlist.isPending(product.id)"
                                class="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-control px-2 text-sm font-medium text-slate-600 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-50"
                                :aria-label="`Remove ${product.name} from wishlist`" @click="remove(product)">
                                <TrashIcon class="h-4 w-4" aria-hidden="true" />
                                Remove
                            </button>

                        </div>

                        <p v-if="feedback[product.id]" :role="feedback[product.id].type === 'error' ? 'alert' : undefined"
                            class="mt-2 text-xs font-medium" :class="feedback[product.id].type === 'error' ? 'text-red-700' : 'text-brand'">
                            {{ feedback[product.id].text }}
                            <RouterLink v-if="feedback[product.id].type === 'success'" :to="{ name: 'cart' }"
                                class="ml-1 font-semibold text-slate-900 underline underline-offset-2 hover:text-brand">
                                View cart
                            </RouterLink>
                        </p>

                    </div>

                </li>

            </ul>

        </div>

    </main>

    <Footer />

</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { ExclamationTriangleIcon, HeartIcon, ShoppingBagIcon, TrashIcon } from "@heroicons/vue/24/outline";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import ProductImage from "@/components/ui/productImage.vue";
import ProductPrice from "@/components/ui/productPrice.vue";

import { ROUTES } from "@/config";
import { useWishlistStore } from "@/stores/wishlistStore";
import { useCartStore } from "@/stores/cartStore";
import { parseApiError } from "@/services/apiClient";

const wishlist = useWishlistStore();
const cart = useCartStore();

const status = ref("");
// productId -> { type: "success" | "error", text }
const feedback = reactive({});
const adding = ref(new Set());

// Current prices and stock every time the page is opened.
const reload = () => wishlist.load({ force: true });

const canAddDirectly = (product) => product.variantId != null && product.variantStock > 0;

// The cart prices the item and checks stock on the server, as on the product page.
async function addToCart(product) {
    if (adding.value.has(product.id)) return;

    adding.value = new Set(adding.value).add(product.id);
    delete feedback[product.id];

    try {
        await cart.addItem(product.variantId, 1, { productId: product.id, stock: product.variantStock, currency: product.currency });
        feedback[product.id] = { type: "success", text: "Added to your cart." };
    } catch (err) {
        feedback[product.id] = { type: "error", text: err.response ? parseApiError(err).message : err.message };
    } finally {
        const next = new Set(adding.value);
        next.delete(product.id);
        adding.value = next;
    }
}

async function remove(product) {
    status.value = "";

    if (await wishlist.remove(product.id)) {
        status.value = `Removed ${product.name} from your wishlist.`;
    } else if (wishlist.actionError?.productId === product.id) {
        feedback[product.id] = { type: "error", text: wishlist.actionError.message };
    }
}

onMounted(reload);
</script>
