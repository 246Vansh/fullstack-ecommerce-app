<template>
    <div class="flex gap-4 lg:flex-col">

        <button v-for="(image, index) in images" :key="index" type="button"
            :aria-label="`Show image ${index + 1} of ${images.length}${productName ? ` of ${productName}` : ''}`"
            :aria-pressed="activeImageIndex === index" @click="$emit('select-image', index)"
            :class="[
                'overflow-hidden rounded-lg border-2 transition',
                activeImageIndex === index
                    ? 'border-indigo-600'
                    : 'border-transparent hover:border-gray-300'
            ]">
            <!-- 128x104 frame; a 3:2 photo covering it is drawn ~160px wide. -->
            <img :src="sizedImage(image, 200)" :srcset="sizedImageSrcset(image, [200, 400, 600])" sizes="160px"
                alt="" class="h-26 w-32 object-cover cursor-pointer" />
        </button>

    </div>
</template>

<script setup>
import { sizedImage, sizedImageSrcset } from "@/utils/images";

defineProps({
    images: {
        type: Array,
        required: true,
    },
    activeImageIndex: {
        type: Number,
        required: true,
    },
    productName: {
        type: String,
        default: "",
    },
});

defineEmits(["select-image"]);
</script>