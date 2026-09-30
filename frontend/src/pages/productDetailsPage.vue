<template>
    <Header />

    <main>

        <ProductDetails v-if="productDetails" :product="productDetails" :related-products="relatedProducts"
            :breadcrumb-items="breadcrumbItems" />

        <!-- Loading / Error -->

        <section v-else class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

            <div class="flex min-h-100 items-center justify-center rounded-xl border border-dashed border-gray-300">

                <div class="flex flex-col items-center text-center">

                    <LoadingSpinner v-if="loading" class="text-gray-400" />

                    <h3 v-else class="text-lg font-semibold text-gray-900">

                        {{ error }}

                    </h3>

                    <RouterLink v-if="!loading" to="/products" class="mt-2 text-sm text-indigo-600 hover:text-indigo-500">

                        Back to products

                    </RouterLink>

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

import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";

import { productService } from "@/services/productService";
import { parseApiError } from "@/services/apiClient";

const route = useRoute();

const productDetails = ref(null);

const relatedProducts = ref([]);

const loading = ref(false);

const error = ref("");

async function loadProduct(id) {

    loading.value = true;
    error.value = "";
    productDetails.value = null;
    relatedProducts.value = [];

    try {

        const product = await productService.getProduct(id);

        productDetails.value = product;

        loadRelated(product);

    } catch (err) {

        const { status, message } = parseApiError(err);

        error.value = status === 404 || status === 422 ? "Product not found" : message;

    } finally {

        loading.value = false;

    }

}

// Related products are optional; a failure leaves the section empty.
async function loadRelated(product) {

    if (!product.category?.slug) return;

    try {

        const { products } = await productService.listProducts({
            category: product.category.slug,
            limit: 5,
        });

        relatedProducts.value = products
            .filter(item => item.id !== product.id)
            .slice(0, 4);

    } catch {
        relatedProducts.value = [];
    }

}

watch(() => route.params.id, (id) => {
    if (id) loadProduct(id);
}, { immediate: true });

const breadcrumbItems = computed(() => [
    {
        label: "Home",
        href: "/",
    },
    {
        label: "Products",
        href: "/products",
    },
    {
        label: productDetails.value?.name || "",
    },
]);

</script>
