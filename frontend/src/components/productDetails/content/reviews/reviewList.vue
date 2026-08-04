<template>

    <div class="space-y-6">

        <ReviewCard v-for="review in reviews" :key="review.id" :review="review" />

    </div>

</template>

<script setup>
import ReviewCard from "./ReviewCard.vue";

defineProps({
    reviews: {
        type: Array,
        default: () => [],
    },
});
</script>