<template>
    <div class="rounded-2xl border border-gray-200 bg-gray-50 p-5">

        <div class="mb-5 flex items-center justify-between">

            <div>

                <h3 class="text-base font-semibold text-gray-900">
                    Size
                </h3>

                <p class="mt-1 text-sm text-gray-500">
                    Select your preferred size
                </p>

            </div>

            <span v-if="selectedSize"
                class="rounded-xl bg-white px-5 py-3 text-sm font-medium text-gray-800 shadow-sm">
                {{ selectedSize.name }}
            </span>

        </div>

        <div class="flex flex-wrap gap-3">

            <ProductSizeOption v-for="size in sizes" :key="size.id" :size="size"
                :is-selected="selectedSize?.id === size.id" @select="$emit('select-size', $event)" />

        </div>

    </div>
</template>

<script setup>
import ProductSizeOption from "./productSizeOption.vue";

defineProps({
    sizes: {
        type: Array,
        default: () => [],
    },

    selectedSize: {
        type: Object,
        default: null,
    },
});

defineEmits([
    "select-size",
]);
</script>