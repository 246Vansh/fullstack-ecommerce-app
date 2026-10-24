<template>
    <div class="overflow-hidden rounded-panel bg-slate-100 ring-1 ring-slate-900/5 ring-inset">

        <!-- Square and at most 70% of the screen height below lg, so the title and
             price start within the first screen on a phone; from lg a 4:5 frame
             like the product cards, about 380-520px wide beside the summary.
             object-cover paints a 3:2 photo at 1.5x (square) / 1.875x (4:5) the
             frame width. -->
        <img :src="sizedImage(image, 1200)" :srcset="sizedImageSrcset(image, [600, 900, 1200, 1600, 2000])"
            sizes="(min-width: 1280px) 970px, (min-width: 1024px) 70vw, calc(150vw - 48px)" :alt="alt"
            class="aspect-square max-h-[70vh] w-full object-cover object-center lg:aspect-4/5 lg:max-h-none" />

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
