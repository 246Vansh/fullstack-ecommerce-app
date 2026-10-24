<template>
    <div>

        <h2 class="text-sm font-medium text-slate-600">
            Color<template v-if="selectedColor">:
                <span class="font-semibold text-slate-900">{{ selectedColor.name }}</span>
            </template>
        </h2>

        <div class="mt-3 flex flex-wrap gap-3" role="group" aria-label="Color">

            <ProductColorOption v-for="color in colors" :key="color.id" :color="color"
                :is-selected="selectedColor?.id === color.id" :unavailable="unavailableIds.includes(color.id)"
                @select="$emit('select-color', $event)" />

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

    // Colors with no in-stock variant for the selected size.
    unavailableIds: {
        type: Array,
        default: () => [],
    },
});

defineEmits([
    "select-color",
]);
</script>
