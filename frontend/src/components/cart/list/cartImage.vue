<template>
    <!-- The name beside it is the item's main link, so this one is skipped by keyboard and screen readers. -->
    <RouterLink :to="{ name: 'product-details', params: { id: product.productId } }" tabindex="-1" aria-hidden="true"
        class="block w-20 shrink-0 self-start overflow-hidden rounded-control bg-slate-100 ring-1 ring-slate-900/5 ring-inset sm:w-24">
        <!-- 4:5 frame up to 96px wide; a 3:2 photo covering it is drawn ~180px wide. -->
        <img v-if="product.image" :src="sizedImage(product.image, 200)" :srcset="sizedImageSrcset(product.image, [200, 400])"
            sizes="180px" alt="" class="aspect-4/5 w-full object-cover" draggable="false" />
        <span v-else class="flex aspect-4/5 w-full items-center justify-center text-slate-400">
            <PhotoIcon class="h-6 w-6" />
        </span>
    </RouterLink>
</template>

<script setup>
import { RouterLink } from "vue-router";
import { PhotoIcon } from "@heroicons/vue/24/outline";

import { sizedImage, sizedImageSrcset } from "@/utils/images";

defineProps({
    product: {
        type: Object,
        required: true,
    },
});
</script>
