<template>
    <div class="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">

        <!-- Same shape as ProductCard (4:5 photo, brand, name, price). -->
        <template v-if="loading">
            <div v-for="n in placeholders" :key="n" aria-hidden="true">
                <div class="aspect-4/5 rounded-card bg-slate-100 motion-safe:animate-pulse"></div>
                <div class="mt-4 h-3 w-1/4 rounded-full bg-slate-100"></div>
                <div class="mt-3 h-4 w-3/4 rounded-full bg-slate-100"></div>
                <div class="mt-3 h-5 w-1/3 rounded-full bg-slate-100"></div>
            </div>
        </template>

        <template v-else>
            <ProductCard v-for="product in products" :key="product.id" :product="product"
                :image-sizes="IMAGE_SIZES" />
        </template>

    </div>
</template>

<script setup>
import ProductCard from "@/components/products/product/productCard.vue";

// Card slots in the max-w-7xl section: one column, two from sm, three
// (384px max) from lg, times the ~1.9 a 3:2 photo paints at under
// object-cover in the 4:5 card. Same value the old New Arrivals card used.
const IMAGE_SIZES = "(min-width: 1280px) 720px, (min-width: 1024px) 56vw, (min-width: 640px) 94vw, 188vw";

defineProps({
    products: {
        type: Array,
        required: true,
    },
    loading: {
        type: Boolean,
        default: false,
    },
    placeholders: {
        type: Number,
        default: 3,
    },
});
</script>
