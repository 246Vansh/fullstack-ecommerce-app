<template>
    <button type="button" :title="color.name" class="group" @click="$emit('select', color)">
        <span class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-all duration-300"
            :class="[
                isSelected
                    ? 'border-2 border-gray-900 bg-white shadow-lg ring-2 ring-gray-200'
                    : 'border border-gray-300 bg-white hover:-translate-y-0.5 hover:border-gray-900 hover:shadow-md'
            ]">
            <span class="h-6 w-6 rounded-full border border-black/10" :style="{ backgroundColor: color.hex }" />
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
});

defineEmits([
    "select",
]);
</script>