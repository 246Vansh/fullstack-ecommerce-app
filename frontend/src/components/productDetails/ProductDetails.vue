<template>
    <section class="bg-white">

        <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

            <ProductDetailsSection :product="product" />

            <div class="mt-20">

                <ProductContent :product="product" />

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


defineProps({
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
</script>