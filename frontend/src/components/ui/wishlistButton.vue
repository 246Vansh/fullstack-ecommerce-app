<template>
    <button type="button" @click="$emit('toggle')"
        class="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white"
        aria-label="Toggle wishlist">
        <HeartIcon :class="[
            isFavorite
                ? 'fill-gray-900 text-gray-900'
                : 'fill-transparent text-gray-600',
            'h-5 w-5 transition-colors duration-300']" />
    </button>
</template>

<script setup>
import { HeartIcon } from "@heroicons/vue/24/outline";

defineProps({
    isFavorite: {
        type: Boolean,
        default: false,
    },
});

defineEmits([
    "toggle",
]);
</script>