<template>

    <button type="button" :aria-pressed="isSelected" @click="$emit('select', size)" :class="[
        'flex h-11 min-w-14 cursor-pointer items-center justify-center rounded-control border px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        isSelected
            ? 'border-brand bg-brand text-white'
            : unavailable
                ? 'border-dashed border-slate-300 bg-white text-slate-400 line-through hover:border-slate-400'
                : 'border-slate-300 bg-white text-slate-900 hover:border-slate-900',
        isSelected && unavailable ? 'line-through' : '',
    ]">

        {{ size.name }}

        <span v-if="unavailable" class="sr-only">, out of stock</span>

    </button>

</template>

<script setup>
defineProps({
    size: {
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
