<template>
    <div class="group relative overflow-hidden rounded-2xl bg-gray-100">

        <img :src="sizedImage(src, 600)" :srcset="sizedImageSrcset(src, [400, 600, 800, 1200])"
            :sizes="sizes" :alt="alt" loading="lazy"
            class="aspect-[4/5] w-full object-cover object-center transition-transform duration-500 group-hover:scale-105" />

    </div>
</template>

<script setup>
import { sizedImage, sizedImageSrcset } from "@/utils/images";

defineProps({

    src: {
        type: String,
        required: true,
    },

    alt: {
        type: String,
        default: "",
    },

    // object-cover scales a 3:2 photo to the 4:5 card's height, so it paints
    // 1.875x the card width. The default is the products grid: two columns
    // below xl (beside the sidebar from lg), three from xl, where max-w-7xl
    // caps the card at 288px. Other layouts pass their own.
    sizes: {
        type: String,
        default: "(min-width: 1280px) 540px, (min-width: 1024px) calc(70vw - 71px), calc(94vw - 45px)",
    },

});
</script>
