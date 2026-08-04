<template>

    <section class="space-y-10">

        <ReviewSummary :average-rating="averageRating" :total-reviews="reviews.length" :breakdown="ratingBreakdown" />

        <ReviewList :reviews="reviews" />

    </section>

</template>

<script setup>
import { computed } from "vue";

import ReviewSummary from "./ReviewSummary.vue";
import ReviewList from "./ReviewList.vue";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const reviews = computed(() => props.product.reviews || []);

const averageRating = computed(() => {

    if (!reviews.value.length) return 0;

    const total = reviews.value.reduce(
        (sum, review) => sum + review.rating,
        0
    );

    return total / reviews.value.length;

});

const ratingBreakdown = computed(() => {

    const total = reviews.value.length;

    return [5, 4, 3, 2, 1].map((star) => {

        const count = reviews.value.filter(
            review => review.rating === star
        ).length;

        return {
            star,
            count,
            percentage: total ? (count / total) * 100 : 0,
        };

    });

});
</script>