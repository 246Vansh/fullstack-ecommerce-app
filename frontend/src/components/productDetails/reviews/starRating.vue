<template>
    <!-- Read-only stars, to the nearest half. Screen readers get one label. -->
    <span class="inline-flex items-center gap-0.5" role="img" :aria-label="ratingLabel(rating)">

        <span v-for="(fill, index) in starFills(rating)" :key="index" class="relative inline-block" :class="sizeClass"
            aria-hidden="true">

            <StarIcon class="absolute inset-0 text-gray-200" :class="sizeClass" />

            <span v-if="fill !== 'empty'" class="absolute inset-y-0 left-0 overflow-hidden"
                :class="fill === 'full' ? 'w-full' : 'w-1/2'">
                <StarIcon class="text-amber-400" :class="sizeClass" />
            </span>

        </span>

    </span>
</template>

<script setup>
import { computed } from "vue";
import { StarIcon } from "@heroicons/vue/20/solid";

import { ratingLabel, starFills } from "@/utils/reviews";

const props = defineProps({
    rating: {
        type: Number,
        default: 0,
    },

    size: {
        type: String,
        default: "md", // sm | md | lg
    },
});

const SIZES = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };

const sizeClass = computed(() => SIZES[props.size] ?? SIZES.md);
</script>
