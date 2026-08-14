<template>

    <button type="button" @click.prevent.stop="toggleFavorite" :aria-pressed="isFavorite" aria-label="Toggle wishlist"
        class="group absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-md backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer">

        <HeartIcon class="h-5 w-5 transition-all duration-200" :class="isFavorite
                ? 'scale-110 fill-red-500 text-red-500'
                : 'text-slate-600 group-hover:text-red-500'
            " />

    </button>

</template>


<script setup>

import { HeartIcon } from "@heroicons/vue/24/outline";


const props = defineProps({

    isFavorite: {

        type: Boolean,

        default: false,

    },

});


const emit = defineEmits([

    "toggle",

]);


const toggleFavorite = () => {

    emit("toggle");

};

</script>