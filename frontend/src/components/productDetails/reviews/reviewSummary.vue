<template>
    <!-- Average and count from the reviews state ProductDetails provides.
         Renders nothing until the first page of reviews has loaded. -->
    <div v-if="summary" class="flex flex-wrap items-center gap-x-2 gap-y-1"
        :class="large ? 'text-base' : 'text-sm'">

        <template v-if="summary.reviewCount > 0">
            <StarRating :rating="summary.averageRating" :size="large ? 'lg' : 'sm'" />

            <span class="font-semibold text-gray-900" aria-hidden="true">
                {{ formatAverage(summary.averageRating) }}
            </span>
        </template>

        <!-- A button, not a #hash link: the router always scrolls to the top
             on navigation, so the section is scrolled to directly. -->
        <button v-if="jumpToReviews" type="button"
            class="cursor-pointer text-gray-500 underline-offset-4 hover:text-gray-900 hover:underline"
            @click="jump">
            {{ reviewCountText(summary.reviewCount) }}
        </button>

        <span v-else class="text-gray-500">
            {{ summary.reviewCount > 0 ? `Based on ${reviewCountText(summary.reviewCount)}` : reviewCountText(0) }}
        </span>

    </div>
</template>

<script setup>
import { computed, inject } from "vue";

import StarRating from "./starRating.vue";
import { PRODUCT_REVIEWS_KEY } from "@/composables/useProductReviews";
import { formatAverage, reviewCountText } from "@/utils/reviews";

defineProps({
    large: {
        type: Boolean,
        default: false,
    },

    // Near the title: the count scrolls to the reviews section.
    jumpToReviews: {
        type: Boolean,
        default: false,
    },
});

const reviews = inject(PRODUCT_REVIEWS_KEY, null);

const summary = computed(() => reviews?.state.summary ?? null);

function jump() {
    const section = document.getElementById("reviews");

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    section?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    document.getElementById("reviews-heading")?.focus({ preventScroll: true });
}
</script>
