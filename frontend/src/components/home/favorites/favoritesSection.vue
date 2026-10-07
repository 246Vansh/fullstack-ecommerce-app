<template>
    <!-- Hidden until real products load; never shows placeholder data. -->
    <section v-if="products.length" aria-labelledby="favorites-heading" class="bg-gray-50">
        <div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">

            <!-- Section Header -->
            <SectionHeader heading-id="favorites-heading" title="New Arrivals" link-text="Shop the collection"
                link-href="/products" />

            <!-- Product Grid -->
            <FavoriteGrid :products="products" />

        </div>
    </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

import SectionHeader from "@/components/ui/sectionHeader.vue";
import FavoriteGrid from "./favoriteGrid.vue";
import { productService } from "@/services/productService";

const products = ref([]);

const controller = new AbortController();

// The three newest catalog products; a failure just leaves the section hidden.
onMounted(async () => {
    try {
        const result = await productService.listProducts(
            { sort: "newest", limit: 3 },
            { signal: controller.signal },
        );

        products.value = result.products;
    } catch {
        products.value = [];
    }
});

onBeforeUnmount(() => controller.abort());
</script>
