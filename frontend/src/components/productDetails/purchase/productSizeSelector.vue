<template>
    <div>

        <h2 class="text-sm font-medium text-slate-600">
            Size<template v-if="selectedSize">:
                <span class="font-semibold text-slate-900">{{ selectedSize.name }}</span>
            </template>
        </h2>

        <div class="mt-3 flex flex-wrap gap-2" role="group" aria-label="Size">

            <ProductSizeOption v-for="size in sizes" :key="size.id" :size="size"
                :is-selected="selectedSize?.id === size.id" :unavailable="unavailableIds.includes(size.id)"
                @select="$emit('select-size', $event)" />

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

    // Sizes with no in-stock variant for the selected color.
    unavailableIds: {
        type: Array,
        default: () => [],
    },
});

defineEmits([
    "select-size",
]);
</script>
