<template>
    <div class="mt-3 flex items-center gap-2">

        <!-- Rating -->

        <div class="flex items-center">

            <StarIcon v-for="star in 5" :key="star" :class="[
                star <= Math.round(rating)
                    ? 'text-yellow-400'
                    : 'text-gray-300',

                'h-4 w-4'
            ]" />

        </div>

        <!-- Reviews -->

        <span class="text-sm text-gray-500">
            ({{ reviewCount }})
        </span>

    </div>
</template>

<script setup>
import { StarIcon } from "@heroicons/vue/24/solid";

defineProps({

    rating: {
        type: Number,
        default: 0,
    },

    reviewCount: {
        type: Number,
        default: 0,
    },

});
</script>