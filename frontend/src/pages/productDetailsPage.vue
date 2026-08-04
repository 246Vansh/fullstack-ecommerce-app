<template>
    <Header />

    <main>

        <ProductDetails :product="productDetails" :related-products="relatedProducts"
            :breadcrumb-items="breadcrumbItems" />

    </main>

    <Footer />
</template>

<script setup>
import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import ProductDetails from "@/components/productDetails/ProductDetails.vue";

import { computed } from "vue";
import { useRoute } from "vue-router";

import { products } from "@/constants/products/products.js";
import { colors } from "@/constants/catalog/colors.js";
import { sizes } from "@/constants/catalog/sizes.js";
import { badges } from "@/constants/catalog/badges.js";

const route = useRoute();

const product = computed(() =>
    products.find(
        item => item.id === Number(route.params.id)
    )
);

const productDetails = computed(() => {
    if (!product.value) return null;

    return {
        ...product.value,

        colors: colors.filter(color =>
            product.value.colorIds.includes(color.id)
        ),

        sizes: sizes.filter(size =>
            product.value.sizeIds.includes(size.id)
        ),

        badge: badges.find(badge =>
            badge.id === product.value.badgeId
        ),
    };
});

const relatedProducts = computed(() => {
    if (!product.value) return [];

    return products.filter(
        item =>
            item.categoryId === product.value.categoryId &&
            item.id !== product.value.id
    );
});

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
        label: product.value?.name || "",
    },
]);

</script>