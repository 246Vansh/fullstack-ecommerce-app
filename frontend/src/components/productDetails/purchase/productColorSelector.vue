<template>
    <div class="rounded-2xl border border-gray-200 bg-gray-50 p-5">

        <div class="mb-5 flex items-center justify-between">

            <div>
                <h3 class="text-base font-semibold text-gray-900">
                    Color
                </h3>

                <p class="mt-1 text-sm text-gray-500">
                    Choose your preferred color
                </p>
            </div>

            <span v-if="selectedColor"
                class="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-800 shadow-sm">
                {{ selectedColor.name }}
            </span>

        </div>

        <div class="flex flex-wrap gap-4">

            <ProductColorOption v-for="color in colors" :key="color.id" :color="color"
                :is-selected="selectedColor?.id === color.id" @select="$emit('select-color', $event)" />

        </div>

    </div>
</template>

<script setup>
import ProductColorOption from "./productColorOption.vue";

defineProps({
    colors: {
        type: Array,
        default: () => [],
    },

    selectedColor: {
        type: Object,
        default: null,
    },
});

defineEmits([
    "select-color",
]);
</script>