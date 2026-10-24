<template>
    <!-- The frame sets the shape; the photo fills it. 1600/2000 serve the tall
         tile on 2x screens. No loading="lazy": every tile is above the fold. -->
    <div class="relative overflow-hidden rounded-card bg-slate-100">
        <img :src="sizedImage(src, 800)" :srcset="sizedImageSrcset(src, [400, 800, 1200, 1600, 2000])" :sizes="sizes" alt=""
            :fetchpriority="priority ? 'high' : undefined"
            class="absolute inset-0 h-full w-full object-cover object-center" />
    </div>
</template>

<script setup>
import { sizedImage, sizedImageSrcset } from "@/utils/images";

defineProps({
    src: {
        type: String,
        required: true,
    },
    sizes: {
        type: String,
        required: true,
    },
    // The largest above-the-fold image (the page's LCP candidate).
    priority: {
        type: Boolean,
        default: false,
    },
});
</script>
