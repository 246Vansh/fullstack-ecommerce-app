<template>
    <!-- Nothing to show (none found or the request failed): no empty heading. -->
    <section v-if="products.length" aria-labelledby="related-heading" class="border-t border-slate-200 pt-12 lg:pt-16">

        <SectionHeader heading-id="related-heading" title="Related Products"
            description="You may also like these products." />

        <div class="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">

            <ProductCard v-for="product in products" :key="product.id" :product="product" :image-sizes="IMAGE_SIZES" />

        </div>

    </section>
</template>

<script setup>
import ProductCard from "@/components/products/product/productCard.vue";
import SectionHeader from "@/components/ui/sectionHeader.vue";

// Card slots in the max-w-7xl page: two columns below lg, four from lg (286px
// once the page is capped), times the 1.875 a 3:2 photo paints at under
// object-cover in the 4:5 card.
const IMAGE_SIZES = "(min-width: 1280px) 536px, (min-width: 1024px) calc(47vw - 64px), (min-width: 640px) calc(94vw - 68px), calc(94vw - 45px)";

defineProps({
    products: {
        type: Array,
        default: () => [],
    },
});
</script>