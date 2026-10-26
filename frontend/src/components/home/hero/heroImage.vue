<template>
    <!-- The frame sets the shape; the photo fills it. 1600/2000 serve the tall
         tile on 2x screens. No loading="lazy": every tile is above the fold.
         When the photo changes, the old and new images overlap in the frame
         and cross-fade (no fade with reduced motion). -->
    <div class="relative overflow-hidden rounded-card bg-slate-100">
        <Transition enter-active-class="motion-safe:transition-opacity motion-safe:duration-700"
            leave-active-class="motion-safe:transition-opacity motion-safe:duration-700"
            enter-from-class="opacity-0" leave-to-class="opacity-0">
            <img :key="src" :src="sizedImage(src, 800)" :srcset="sizedImageSrcset(src, HERO_WIDTHS)" :sizes="sizes" alt=""
                :fetchpriority="priority ? 'high' : undefined"
                class="absolute inset-0 h-full w-full object-cover object-center" />
        </Transition>
    </div>
</template>

<script>
// The widths offered in srcset; heroSection preloads the next photos with the same list.
export const HERO_WIDTHS = [400, 800, 1200, 1600, 2000];
</script>

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
