<template>
    <!-- The whole tile is the link (stretched span); the ring shows keyboard focus on it. -->
    <div class="group relative overflow-hidden rounded-card bg-slate-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2"
        :class="card.large
            ? 'aspect-2/1 sm:row-span-2 sm:aspect-square'
            : 'aspect-2/1 sm:aspect-auto'">

        <!-- Image: full width, half (592px max) from sm. -->
        <img :src="sizedImage(card.image, 800)" :srcset="sizedImageSrcset(card.image, [400, 800, 1200])"
            sizes="(min-width: 1280px) 592px, (min-width: 640px) 50vw, 100vw" :alt="card.alt" loading="lazy"
            class="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03]" />

        <!-- Overlay: darkest at the bottom, where the text sits. -->
        <div aria-hidden="true" class="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent"></div>

        <!-- Content -->
        <div class="absolute inset-0 flex items-end p-6 sm:p-8">
            <div>
                <h3 class="text-xl font-semibold text-white">
                    <RouterLink :to="card.to" class="focus-visible:outline-none">
                        <span class="absolute inset-0"></span>
                        {{ card.title }}
                    </RouterLink>
                </h3>

                <p aria-hidden="true" class="mt-1 text-sm font-medium text-white/90">
                    Shop now &rarr;
                </p>
            </div>
        </div>

    </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';

import { sizedImage, sizedImageSrcset } from "@/utils/images";

defineProps({
    card: {
        type: Object,
        required: true,
    },
});
</script>
