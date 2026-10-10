<template>
    <div class="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div class="h-[860px]">

            <!-- The frame is 860px tall at every width and object-cover fills
                 it by height, so a 3:2 photo is drawn ~1290px wide. -->
            <img :src="sizedImage(image, 1600)" :srcset="sizedImageSrcset(image, [800, 1200, 1600, 2400])"
                sizes="1290px" :alt="alt"
                class="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />

        </div>
    </div>
</template>

<script setup>
import { sizedImage, sizedImageSrcset } from "@/utils/images";

defineProps({
    image: {
        type: String,
        required: true,
    },

    // The product name; the gallery shows one product.
    alt: {
        type: String,
        default: "",
    },
});
</script>