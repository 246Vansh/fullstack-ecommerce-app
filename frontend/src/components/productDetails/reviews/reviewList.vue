<template>
    <ul role="list" class="divide-y divide-gray-200">

        <li v-for="review in reviews" :key="review.id" class="py-8 first:pt-0">

            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <StarRating :rating="review.rating" size="sm" />

                <span v-if="review.verifiedPurchase"
                    class="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckBadgeIcon class="h-4 w-4" aria-hidden="true" />
                    Verified purchase
                </span>
            </div>

            <!-- pre-line keeps the customer's paragraphs; text is never rendered as HTML. -->
            <p class="mt-3 whitespace-pre-line break-words text-sm leading-6 text-gray-700">{{ review.body }}</p>

            <p class="mt-3 text-sm text-gray-500">
                <span class="font-medium text-gray-900">{{ review.author }}</span>
                <span aria-hidden="true"> · </span>
                <time :datetime="review.createdAt">{{ formatReviewDate(review.createdAt) }}</time>
            </p>

        </li>

    </ul>
</template>

<script setup>
import { CheckBadgeIcon } from "@heroicons/vue/20/solid";

import StarRating from "./starRating.vue";
import { formatReviewDate } from "@/utils/reviews";

defineProps({
    reviews: {
        type: Array,
        required: true,
    },
});
</script>
