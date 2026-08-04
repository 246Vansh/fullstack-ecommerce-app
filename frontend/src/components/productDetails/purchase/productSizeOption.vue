<template>

    <button type="button" @click="$emit('select', size)"
        class="group relative overflow-hidden rounded-xl transition-all duration-300 cursor-pointer" :class="[
            isSelected
                ? 'bg-gray-900 text-white shadow-lg'
                : 'border border-gray-300 bg-white text-gray-900 hover:-translate-y-0.5 hover:border-gray-900 hover:shadow-md'
        ]">

        <span class="flex h-12 min-w-[64px] items-center justify-center px-5 text-sm font-semibold tracking-wide">
            {{ size.name }}
        </span>

        <span v-if="isSelected" class="absolute right-2 top-2 h-2 w-2 rounded-full bg-green-400" />

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
});

defineEmits([
    "select",
]);
</script>