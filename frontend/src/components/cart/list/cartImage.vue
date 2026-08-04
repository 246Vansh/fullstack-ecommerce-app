<template>
    <div class="flex h-40 items-center justify-center overflow-hidden rounded-3xl bg-gray-50 cursor-pointer">
        <img :src="product.image" :alt="product.title"
            class="h-full w-full object-contain p-5 transition-transform duration-300 hover:scale-105"
            draggable="false" />
    </div>
</template>

<script setup>
defineProps({
    product: {
        type: Object,
        required: true,
    },
});
</script>