<template>
    <div class="group relative overflow-hidden rounded-lg" :class="card.large
        ? '[aspect-2/1] sm:row-span-2 sm:aspect-square'
        : '[aspect-2/1] sm:aspect-auto'">

        <!-- Image -->
        <img :src="card.image" :alt="card.alt"
            class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-75" />

        <!-- Overlay -->
        <div aria-hidden="true" class="absolute inset-0 bg-linear-to-b from-transparent to-black opacity-50"></div>

        <!-- Content -->
        <div class="absolute inset-0 flex items-end p-6">

            <div>

                <h3 class="font-semibold text-white">

                    <RouterLink to="/">

                        <span class="absolute inset-0"></span>

                        {{ card.title }}

                    </RouterLink>

                </h3>

                <p class="mt-1 text-sm text-white">
                    Shop now
                </p>

            </div>

        </div>

    </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';

defineProps({
    card: {
        type: Object,
        required: true,
    },
});

</script>