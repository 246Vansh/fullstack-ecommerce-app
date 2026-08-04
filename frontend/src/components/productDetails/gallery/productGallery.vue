<template>
    <div class="lg:sticky lg:top-28">

        <div class="grid gap-6 lg:grid-cols-[90px_1fr]">

            <ThumbnailList :images="product.images" :active-image-index="activeImageIndex"
                @select-image="setActiveImage" />

            <ProductImage :image="activeImage" />

        </div>

    </div>
</template>

<script setup>
import { computed, ref } from "vue";

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

const setActiveImage = (index) => {
    activeImageIndex.value = index;
};
</script>