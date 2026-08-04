<template>
    <article class="group relative flex flex-col">

        <!-- Product Image -->
        <div class="relative">

            <ProductImage :src="product.image" :alt="product.name" />
            <ProductBadge :badge="badge" />
            <WishlistButton :isFavorite="product.isFavorite" @toggle="$emit('toggle-wishlist', product.id)" />

        </div>

        <!-- Product Details -->
        <div class="flex flex-1 flex-col">

            <ProductInfo :brand="brand?.name" :name="product.name" />
            <ProductRating :rating="product.rating" :reviewCount="product.reviewCount" />
            <ProductPrice :price="product.price" :originalPrice="product.originalPrice" />

        </div>

    </article>
</template>

<script setup>
import { computed } from "vue";

import ProductImage from "@/components/ui/productImage.vue";
import WishlistButton from "@/components/ui/wishlistButton.vue";
import ProductPrice from "@/components/ui/productPrice.vue";
import ProductRating from "@/components/ui/productRating.vue";

import ProductBadge from "./productBadge.vue";
import ProductInfo from "./productInfo.vue";

import { brands } from "@/constants/catalog/brands";
import { badges } from "@/constants/catalog/badges";

const props = defineProps({

    product: {
        type: Object,
        required: true,
    },

});

defineEmits([
    "toggle-wishlist",
]);

const brand = computed(() => {
    return brands.find(
        item => item.id === props.product.brandId
    );
});

const badge = computed(() => {
    return badges.find(
        item => item.id === props.product.badgeId
    );
});
</script>