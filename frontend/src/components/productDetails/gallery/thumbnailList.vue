<template>
    <!-- A row that scrolls sideways below lg (never widening the page), a column from lg. -->
    <div class="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">

        <button v-for="(image, index) in images" :key="index" type="button"
            :aria-label="`Show image ${index + 1} of ${images.length}${productName ? ` of ${productName}` : ''}`"
            :aria-pressed="activeImageIndex === index" @click="$emit('select-image', index)"
            :class="[
                'w-16 shrink-0 cursor-pointer overflow-hidden rounded-control bg-slate-100 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:w-full',
                activeImageIndex === index
                    ? 'ring-2 ring-brand ring-offset-2'
                    : 'opacity-75 ring-1 ring-slate-900/5 hover:opacity-100'
            ]">
            <!-- 4:5 frame up to 72px wide; a 3:2 photo covering it is drawn ~135px wide. -->
            <img :src="sizedImage(image, 200)" :srcset="sizedImageSrcset(image, [200, 400])" sizes="135px"
                alt="" class="aspect-4/5 w-full object-cover" />
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
