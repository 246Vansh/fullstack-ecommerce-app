<template>

    <div class="space-y-5">

        <ProductRating :rating="product.rating" :reviewCount="product.reviewCount" />

        <ProductPrice :price="product.price" :original-price="product.originalPrice" />

        <div class="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3">

            <span class="h-2.5 w-2.5 rounded-full bg-green-500" />

            <span class="text-sm font-semibold text-green-700">
                In Stock · Ready to Ship
            </span>

        </div>

    </div>

</template>

<script setup>
import ProductRating from "@/components/ui/productRating.vue";
import ProductPrice from "@/components/ui/productPrice.vue";

defineProps({
    product: {
        type: Object,
        required: true,
    },
});
</script>