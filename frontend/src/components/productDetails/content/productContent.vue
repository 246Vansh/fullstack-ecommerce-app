<template>
    <section>

        <!-- Tab Navigation -->
        <TabNavigation :tabs="tabs" :active-tab="activeTab" @change-tab="changeTab" />

        <!-- Tab Content -->
        <div :id="`product-panel-${activeTab}`" role="tabpanel" tabindex="0" :aria-labelledby="`product-tab-${activeTab}`"
            class="mt-8 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">

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
    // No Reviews tab: reviews have their own section below (reviews/productReviews.vue).
];

const changeTab = (tab) => {
    activeTab.value = tab;
};
</script>