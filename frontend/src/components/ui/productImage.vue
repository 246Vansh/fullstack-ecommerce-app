<template>
    <div class="group relative overflow-hidden rounded-2xl bg-gray-100">

        <img :src="src" :alt="alt" loading="lazy"
            class="aspect-[4/5] w-full object-cover object-center transition-transform duration-500 group-hover:scale-105" />

    </div>
</template>

<script setup>
defineProps({

    src: {
        type: String,
        required: true,
    },

    alt: {
        type: String,
        default: "",
    },

});
</script>