<template>
    <section class="mt-20">

        <!-- Tab Navigation -->
        <TabNavigation :tabs="tabs" :active-tab="activeTab" @change-tab="changeTab" />

        <!-- Tab Content -->
        <div class="mt-10">

            <ProductDescription v-if="activeTab === 'description'" :product="product" />

            <ProductSpecifications v-else-if="activeTab === 'specifications'" :product="product" />

            <ProductShipping v-else-if="activeTab === 'shipping'" />

            <ProductReturns v-else-if="activeTab === 'returns'" />

            <ProductReviews v-else-if="activeTab === 'reviews'" :product="product" />

        </div>

    </section>
</template>

<script setup>
import { ref } from "vue";

import TabNavigation from "./sections/tabNavigation.vue";
import ProductDescription from "./sections/productDescription.vue";
import ProductSpecifications from "./sections/productSpecifications.vue";
import ProductShipping from "./sections/productShipping.vue";
import ProductReturns from "./sections/productReturns.vue";
import ProductReviews from "./reviews/productReviews.vue";

defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const activeTab = ref("description");

const tabs = [
    {
        id: "description",
        label: "Description",
    },
    {
        id: "specifications",
        label: "Specifications",
    },
    {
        id: "shipping",
        label: "Shipping",
    },
    {
        id: "returns",
        label: "Returns",
    },
    {
        id: "reviews",
        label: "Reviews",
    },
];

const changeTab = (tab) => {
    activeTab.value = tab;
};
</script>