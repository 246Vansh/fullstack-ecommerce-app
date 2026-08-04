<template>
    <div class="flex gap-4 lg:flex-col">

        <button v-for="(image, index) in images" :key="index" type="button" @click="$emit('select-image', index)"
            :class="[
                'overflow-hidden rounded-lg border-2 transition',
                activeImageIndex === index
                    ? 'border-indigo-600'
                    : 'border-transparent hover:border-gray-300'
            ]">
            <img :src="image" :alt="`Product Thumbnail ${index + 1}`" class="h-26 w-32 object-cover cursor-pointer" />
        </button>

    </div>
</template>

<script setup>
defineProps({
    images: {
        type: Array,
        required: true,
    },
    activeImageIndex: {
        type: Number,
        required: true,
    },
});

defineEmits(["select-image"]);
</script>