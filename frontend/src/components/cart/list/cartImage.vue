<template>
    <div class="flex h-40 items-center justify-center overflow-hidden rounded-3xl bg-gray-50 cursor-pointer">
        <!-- Contained in a 120px-tall box, so even a 3:2 photo is ~180px wide. -->
        <img :src="sizedImage(product.image, 200)" :srcset="sizedImageSrcset(product.image, [200, 400, 600])"
            sizes="180px" :alt="product.title"
            class="h-full w-full object-contain p-5 transition-transform duration-300 hover:scale-105"
            draggable="false" />
    </div>
</template>

<script setup>
import { sizedImage, sizedImageSrcset } from "@/utils/images";

defineProps({
    product: {
        type: Object,
        required: true,
    },
});
</script>