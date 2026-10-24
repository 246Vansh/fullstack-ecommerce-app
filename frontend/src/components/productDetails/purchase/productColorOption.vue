<template>
    <button type="button" :title="unavailable ? `${color.name} (out of stock)` : color.name"
        :aria-label="unavailable ? `${color.name}, out of stock` : color.name" :aria-pressed="isSelected"
        :class="[
            'relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-shadow duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand',
            isSelected
                ? 'ring-2 ring-brand ring-offset-2'
                : 'ring-1 ring-slate-300 hover:ring-slate-500'
        ]" @click="$emit('select', color)">

        <span class="h-8 w-8 rounded-full border border-black/10" :class="unavailable ? 'opacity-40' : ''"
            :style="{ backgroundColor: color.hex }" />

        <!-- A diagonal line through an out-of-stock swatch. -->
        <span v-if="unavailable" class="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true">
            <span class="h-px w-9 -rotate-45 bg-slate-500" />
        </span>

    </button>
</template>

<script setup>
defineProps({
    color: {
        type: Object,
        required: true,
    },

    isSelected: {
        type: Boolean,
        default: false,
    },

    unavailable: {
        type: Boolean,
        default: false,
    },
});

defineEmits([
    "select",
]);
</script>
