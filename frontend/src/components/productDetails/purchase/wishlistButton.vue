<template>
    <button type="button" :disabled="disabled"
        class="group flex h-14 w-14 items-center justify-center rounded-xl border-2 transition-all duration-300" :class="[
            disabled
                ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                : isWishlisted
                    ? 'border-red-500 bg-red-50 text-red-500 hover:bg-red-100'
                    : 'border-gray-900 bg-white text-gray-900 hover:-translate-y-0.5 hover:bg-gray-900 hover:text-white hover:shadow-lg active:scale-[0.98] cursor-pointer'
        ]" @click="$emit('toggle-wishlist')">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 transition-transform duration-300 group-hover:scale-110"
            :fill="isWishlisted ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
                d="M21.752 6.17a5.25 5.25 0 00-7.424 0L12 8.498 9.672 6.17a5.25 5.25 0 10-7.424 7.424L12 23l9.752-9.406a5.25 5.25 0 000-7.424z" />
        </svg>
    </button>
</template>

<script setup>
defineProps({
    disabled: Boolean,
    isWishlisted: {
        type: Boolean,
        default: false,
    },
});

defineEmits(["toggle-wishlist"]);
</script>