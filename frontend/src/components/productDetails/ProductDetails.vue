<template>
    <section class="bg-white">

        <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

            <ProductDetailsSection :product="product" />

            <div class="mt-20">

                <ProductContent :product="product" />

            </div>

            <div class="mt-20">

                <ProductReviews />

            </div>

            <div class="mt-20">

                <RelatedSection :products="relatedProducts" />

            </div>

        </div>

    </section>
</template>

<script setup>
import ProductDetailsSection from "./layout/productDetailsSection.vue";
import ProductContent from "./content/productContent.vue";
import RelatedSection from "./related/relatedSection.vue";
import ProductReviews from "./reviews/productReviews.vue";

import { computed, onBeforeUnmount, provide, watch } from "vue";

import { useAuthStore } from "@/stores/authStore";
import { reviewService } from "@/services/reviewService";
import { parseApiError } from "@/services/apiClient";
import { PRODUCT_REVIEWS_KEY, useProductReviews } from "@/composables/useProductReviews";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },

    relatedProducts: {
        type: Array,
        default: () => [],
    },

    breadcrumbItems: {
        type: Array,
        default: () => [],
    },
});

// One reviews state for the page: the summary near the title and the reviews
// section both read it, so the first page of reviews is requested once.
const authStore = useAuthStore();
const reviews = useProductReviews({ service: reviewService, parseError: parseApiError });

provide(PRODUCT_REVIEWS_KEY, reviews);

const viewer = computed(() => (authStore.user ? { id: authStore.user.id, role: authStore.user.role } : null));

watch(() => props.product.id, (id) => reviews.load(id, viewer.value), { immediate: true });

// Signing in or out on this page (or the session restoring after load).
watch(() => [viewer.value?.id, viewer.value?.role], () => reviews.setViewer(viewer.value));

onBeforeUnmount(() => reviews.dispose());
</script>