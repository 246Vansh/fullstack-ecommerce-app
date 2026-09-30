<template>
    <RouterLink :to="{
        name: 'product-details',
        params: {
            id: product.id,
        },
    }">
        <article class="group relative flex flex-col">

            <!-- Product Image -->

            <div class="relative">

                <ProductImage :src="product.image" :alt="product.name" />

                <!-- Product Badge -->

                <ProductBadge :badge="badge" />

            </div>


            <!-- Product Details -->

            <div class="flex flex-1 flex-col">

                <ProductInfo :brand="brand?.name" :name="product.name" />

                <ProductPrice :price="product.price" :originalPrice="product.originalPrice" />

            </div>

        </article>
    </RouterLink>

</template>


<script setup>
import { RouterLink } from "vue-router"
import { computed } from "vue";


import ProductImage from "@/components/ui/productImage.vue";

import ProductPrice from "@/components/ui/productPrice.vue";


import ProductBadge from "./productBadge.vue";

import ProductInfo from "./productInfo.vue";


import { brands } from "@/constants/catalog/brands";

import { badges } from "@/constants/catalog/badges";


// --------------------------------------------------
// Props
// --------------------------------------------------

const props = defineProps({

    product: {

        type: Object,

        required: true,

    },

});


// --------------------------------------------------
// Brand
// --------------------------------------------------

const brand = computed(() => {

    return brands.find(

        item => item.id === props.product.brandId

    );

});


// --------------------------------------------------
// Badge
// --------------------------------------------------

const badge = computed(() => {

    return badges.find(

        item => item.id === props.product.badgeId

    );

});

</script>