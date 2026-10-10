<template>
    <div class="group relative">

        <!-- Product Image -->
        <!-- One column, two from sm, three (384px max) from lg. A 3:2 photo
             covering the 4:5 frame is drawn ~1.9x the column width. -->
        <div class="aspect-[4/5] w-full overflow-hidden rounded-lg bg-gray-100">
            <img :src="sizedImage(product.image, 800)" :srcset="sizedImageSrcset(product.image, [400, 600, 800, 1200])"
                sizes="(min-width: 1280px) 720px, (min-width: 1024px) 56vw, (min-width: 640px) 94vw, 188vw"
                :alt="product.alt ?? product.name" loading="lazy"
                class="h-full w-full object-cover object-center transition-opacity duration-300 group-hover:opacity-75" />
        </div>

        <!-- Product Info -->
        <div class="mt-4 flex items-center justify-between">

            <div>

                <h3 class="text-sm font-medium text-gray-900">
                    <RouterLink :to="{ name: 'product-details', params: { id: product.id } }">

                        <span aria-hidden="true" class="absolute inset-0"></span>

                        {{ product.name }}

                    </RouterLink>
                </h3>

            </div>

            <p class="text-sm font-medium text-gray-900">
                {{ formatPrice(product.price) }}
            </p>

        </div>

    </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';
import { formatPrice } from "@/utils/money";
import { sizedImage, sizedImageSrcset } from "@/utils/images";

defineProps({
    product: {
        type: Object,
        required: true,
    },
});

</script>