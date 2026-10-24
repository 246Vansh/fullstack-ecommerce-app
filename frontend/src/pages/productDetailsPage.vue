<template>
    <Header />

    <main id="main-content" tabindex="-1">

        <ProductDetails v-if="productDetails" :product="productDetails" :related-products="relatedProducts"
            :breadcrumb-items="breadcrumbItems" />

        <!-- Loading -->

        <section v-else-if="loading" class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">

            <LoadingSpinner class="sr-only" label="Loading product" />

            <!-- Same shape as the loaded page: gallery beside the summary from lg. -->
            <div class="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[12fr_11fr] lg:gap-14" aria-hidden="true">
                <div class="aspect-square max-h-[70vh] rounded-panel bg-slate-100 motion-safe:animate-pulse lg:aspect-4/5 lg:max-h-none"></div>
                <div class="space-y-4 lg:pt-4">
                    <div class="h-3 w-24 rounded-full bg-slate-100"></div>
                    <div class="h-8 w-3/4 rounded-full bg-slate-100"></div>
                    <div class="h-8 w-1/3 rounded-full bg-slate-100"></div>
                    <div class="h-14 w-full rounded-control bg-slate-100"></div>
                </div>
            </div>

        </section>

        <!-- Not found / Error -->

        <section v-else class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

            <div class="flex min-h-96 items-center justify-center rounded-panel bg-surface px-6 py-16">

                <div class="flex max-w-sm flex-col items-center text-center">

                    <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-card">
                        <MagnifyingGlassIcon v-if="notFound" class="h-6 w-6" aria-hidden="true" />
                        <ExclamationTriangleIcon v-else class="h-6 w-6" aria-hidden="true" />
                    </span>

                    <h1 tabindex="-1" class="mt-5 text-xl font-semibold text-slate-900">

                        {{ error }}

                    </h1>

                    <p class="mt-2 text-sm text-slate-600">
                        {{ notFound
                            ? "This product may have been removed or the link is incorrect."
                            : "Please check your connection and try again." }}
                    </p>

                    <div class="mt-6 flex flex-wrap justify-center gap-3">

                        <PrimaryButton v-if="!notFound" tag="button" @click="loadProduct(route.params.id)">
                            Try again
                        </PrimaryButton>

                        <PrimaryButton to="/products" :variant="notFound ? 'primary' : 'outline'">
                            Back to products
                        </PrimaryButton>

                    </div>

                </div>

            </div>

        </section>

    </main>

    <Footer />
</template>

<script setup>
import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import ProductDetails from "@/components/productDetails/ProductDetails.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import { ExclamationTriangleIcon, MagnifyingGlassIcon } from "@heroicons/vue/24/outline";

import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";

import { productService } from "@/services/productService";
import { parseApiError } from "@/services/apiClient";
import { focusHeadingAfterLoad, setPageTitle } from "@/router/pageFocus";

const route = useRoute();

const productDetails = ref(null);

const relatedProducts = ref([]);

const loading = ref(false);

const error = ref("");

// Only the latest navigation may write state: each load aborts the previous
// one, and the id check drops any response that still settles afterwards.
let requestId = 0;
let controller = null;

async function loadProduct(id) {

    const current = ++requestId;
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;

    loading.value = true;
    error.value = "";
    productDetails.value = null;
    relatedProducts.value = [];

    try {

        const product = await productService.getProduct(id, { signal });

        if (current !== requestId) return;

        productDetails.value = product;

        setPageTitle(product.name);
        focusHeadingAfterLoad();

        loadRelated(product, current, signal);

    } catch (err) {

        if (current !== requestId) return;

        const { status, message } = parseApiError(err);

        error.value = status === 404 || status === 422 ? "Product not found" : message;

        setPageTitle(error.value === "Product not found" ? "Product Not Found" : "Product");
        focusHeadingAfterLoad();

    } finally {

        if (current === requestId) loading.value = false;

    }

}

// Related products are optional; a failure leaves the section empty.
async function loadRelated(product, current, signal) {

    if (!product.category?.slug) return;

    try {

        const { products } = await productService.listProducts({
            category: product.category.slug,
            limit: 5,
        }, { signal });

        if (current !== requestId) return;

        relatedProducts.value = products
            .filter(item => item.id !== product.id)
            .slice(0, 4);

    } catch {
        if (current === requestId) relatedProducts.value = [];
    }

}

onBeforeUnmount(() => {
    requestId++;
    controller?.abort();
});

watch(() => route.params.id, (id) => {
    if (id) loadProduct(id);
}, { immediate: true });

const notFound = computed(() => error.value === "Product not found");

// Same item shape as the catalog breadcrumb (components/products/breadcrumb.vue).
const breadcrumbItems = computed(() => [
    {
        name: "Home",
        href: "/",
    },
    {
        name: "Products",
        href: "/products",
    },
    ...(productDetails.value?.category?.slug && productDetails.value.category.name
        ? [{
            name: productDetails.value.category.name,
            href: { name: "products", query: { category: productDetails.value.category.slug } },
        }]
        : []),
    {
        name: productDetails.value?.name || "",
        current: true,
    },
]);

</script>
