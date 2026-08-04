<template>
    <button type="button" :disabled="disabled"
        class="flex h-14 flex-1 items-center justify-center rounded-xl text-base font-semibold tracking-wide uppercase transition-all duration-300"
        :class="[
            disabled
                ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                : 'bg-yellow-300 text-black shadow-md hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] cursor-pointer'
        ]">
        Add to Cart
        <svg v-if="!disabled" xmlns="http://www.w3.org/2000/svg"
            class="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
        </svg>
    </button>
</template>

<script setup>
defineProps({
    disabled: Boolean,
});
</script>