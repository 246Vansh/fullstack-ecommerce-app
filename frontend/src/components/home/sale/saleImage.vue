<template>
    <div class="group relative overflow-hidden rounded-lg bg-gray-100" :class="image.class">
        <img :src="image.image" :alt="image.alt"
            class="h-full w-full object-cover object-center transition-opacity duration-300 group-hover:opacity-75"
            loading="lazy" />

        <!-- Optional Overlay -->
        <div v-if="image.overlay"
            class="absolute inset-0 bg-black/20 transition-opacity duration-300 group-hover:bg-black/30"></div>
    </div>
</template>

<script setup>
defineProps({
    image: {
        type: Object,
        required: true,
    },
});
</script>