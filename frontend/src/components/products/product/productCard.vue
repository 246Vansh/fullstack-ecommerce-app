<template>
    <!-- The wishlist button sits over the image but outside the link (a button inside a link is invalid). -->
    <div class="relative">
    <RouterLink :to="{
        name: 'product-details',
        params: {
            id: product.id,
        },
    }" class="group block rounded-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
        <article class="relative flex h-full flex-col">

            <!-- Product Image -->

            <div class="relative">

                <!-- The link already reads the product name, so the image is not announced again. -->
                <ProductImage :src="product.image" alt="" :sizes="imageSizes"
                    :class="soldOut ? 'opacity-70 grayscale-[30%]' : ''" />

                <!-- Product Badge (a catalog badge first, otherwise the markdown) -->

                <ProductBadge :badge="badge" />

                <!-- Sold out: list items carry inStock (any variant with stock). -->
                <span v-if="soldOut"
                    class="pointer-events-none absolute bottom-3 left-3 z-10 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold leading-none text-slate-900 shadow-sm">
                    Sold out
                </span>

            </div>


            <!-- Product Details -->

            <div class="flex flex-1 flex-col">

                <ProductInfo :brand="product.brand" :name="product.name" />

                <ProductPrice :price="product.price" :originalPrice="product.originalPrice" :currency="product.currency" />

            </div>

        </article>
    </RouterLink>

    <!-- A frame the size of the image (same 4:5 ratio as ProductImage, at the top of
         the card) so the heart is placed within the image; clicks pass through it to the link. -->
    <div class="pointer-events-none absolute inset-x-0 top-0 z-20 aspect-[4/5]">
        <div class="pointer-events-auto absolute top-2.5 right-2.5 sm:top-3 sm:right-3">
            <WishlistButton overlay :product-id="product.id" :name="product.name" />
        </div>
    </div>
    </div>

</template>


<script setup>
import { RouterLink } from "vue-router"
import { computed } from "vue";


import ProductImage from "@/components/ui/productImage.vue";

import ProductPrice from "@/components/ui/productPrice.vue";

import WishlistButton from "@/components/ui/wishlistButton.vue";


import ProductBadge from "./productBadge.vue";

import ProductInfo from "./productInfo.vue";


import { badges } from "@/constants/catalog/badges";

import { discountPercent } from "@/utils/money";


// --------------------------------------------------
// Props
// --------------------------------------------------

const props = defineProps({

    product: {

        type: Object,

        required: true,

    },

    // Image `sizes` for layouts other than the products grid; unset keeps
    // ProductImage's default.
    imageSizes: {

        type: String,

        default: undefined,

    },

});



// --------------------------------------------------
// Badge
// --------------------------------------------------

const badge = computed(() => {

    const catalogBadge = badges.find(

        item => item.id === props.product.badgeId

    );

    if (catalogBadge) return catalogBadge;

    const percent = discountPercent(props.product.price, props.product.originalPrice);

    return percent > 0
        ? { id: "discount", name: `${percent}% off`, background: "bg-brand", text: "text-white" }
        : null;

});

// Only an explicit false: products without the field are not marked.
const soldOut = computed(() => props.product.inStock === false);

</script>
