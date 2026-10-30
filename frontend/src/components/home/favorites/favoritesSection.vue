<template>
    <!-- Placeholders while loading (so the page does not jump), real products
         once loaded; never placeholder data. A failure or an empty catalog
         hides the section. -->
    <section v-if="loading || products.length" aria-labelledby="favorites-heading" :aria-busy="loading"
        class="border-t border-slate-200 bg-white">

        <div class="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-20 lg:px-8">

            <!-- Section Header -->
            <SectionHeader heading-id="favorites-heading" title="New Arrivals"
                description="The latest additions to the catalog." link-text="Shop all products"
                link-href="/products" />

            <!-- Product row, sliding through the newest products one at a time. -->
            <FavoriteGrid :products="products" :loading="loading" :placeholders="3" />

        </div>

    </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

import SectionHeader from "@/components/ui/sectionHeader.vue";
import FavoriteGrid from "./favoriteGrid.vue";

import { productService } from "@/services/productService";

// Newest products the row cycles through.
const POOL = 12;

const products = ref([]);
const loading = ref(true);

const controller = new AbortController();

// The newest catalog products; a failure just leaves the section hidden.
onMounted(async () => {
    try {
        const result = await productService.listProducts(
            { sort: "newest", limit: POOL },
            { signal: controller.signal },
        );

        products.value = result.products;
    } catch {
        products.value = [];
    } finally {
        loading.value = false;
    }
});

onBeforeUnmount(() => controller.abort());
</script>
