<template>
    <div class="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div class="h-[860px]">

            <img :src="image" :alt="alt"
                class="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />

        </div>
    </div>
</template>

<script setup>
defineProps({
    image: {
        type: String,
        required: true,
    },

    // The product name; the gallery shows one product.
    alt: {
        type: String,
        default: "",
    },
});
</script>