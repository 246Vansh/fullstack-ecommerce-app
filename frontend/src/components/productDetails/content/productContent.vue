<template>
    <section class="mt-20">

        <!-- Tab Navigation -->
        <TabNavigation :tabs="tabs" :active-tab="activeTab" @change-tab="changeTab" />

        <!-- Tab Content -->
        <div class="mt-10">

            <ProductDescription v-if="activeTab === 'description'" :product="product" />

            <ProductSpecifications v-else-if="activeTab === 'specifications'" :product="product" />

            <ProductShipping v-else-if="activeTab === 'shipping'" />

        </div>

    </section>
</template>

<script setup>
import { ref } from "vue";

import TabNavigation from "./sections/tabNavigation.vue";
import ProductDescription from "./sections/productDescription.vue";
import ProductSpecifications from "./sections/productSpecifications.vue";
import ProductShipping from "./sections/productShipping.vue";

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
    // No Returns tab: there is no return policy or return flow yet.
    // No Reviews tab: there is no review system yet.
];

const changeTab = (tab) => {
    activeTab.value = tab;
};
</script>