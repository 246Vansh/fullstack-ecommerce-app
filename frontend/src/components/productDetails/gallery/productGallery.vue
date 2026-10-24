<template>
    <div class="lg:sticky lg:top-24 lg:self-start">

        <!-- The photo comes first (above the thumbnails on mobile); from lg the
             thumbnails move to a column on its left. -->
        <div :class="['flex flex-col gap-3', product.images.length > 1 ? 'lg:grid lg:grid-cols-[72px_1fr] lg:gap-4' : '']">

            <ProductImage v-if="activeImage" :image="activeImage" :alt="imageAlt" />

            <!-- A product without photos keeps the frame, so the layout does not collapse. -->
            <div v-else class="flex aspect-square max-h-[70vh] w-full items-center justify-center rounded-panel bg-slate-100 text-slate-400 lg:aspect-4/5 lg:max-h-none">
                <PhotoIcon class="h-12 w-12" aria-hidden="true" />
                <span class="sr-only">No image available</span>
            </div>

            <ThumbnailList v-if="product.images.length > 1" class="lg:order-first" :images="product.images"
                :active-image-index="activeImageIndex" :product-name="product.name" @select-image="setActiveImage" />

        </div>

    </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { PhotoIcon } from "@heroicons/vue/24/outline";

import ProductImage from "./productImage.vue";
import ThumbnailList from "./thumbnailList.vue";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const activeImageIndex = ref(0);

const activeImage = computed(() => {
    return props.product.images[activeImageIndex.value];
});

// "Name, image 2 of 4" once there is more than one photo to tell apart.
const imageAlt = computed(() => (props.product.images.length > 1
    ? `${props.product.name}, image ${activeImageIndex.value + 1} of ${props.product.images.length}`
    : props.product.name));

const setActiveImage = (index) => {
    activeImageIndex.value = index;
};
</script>
