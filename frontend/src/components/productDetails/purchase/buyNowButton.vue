<template>
    <button type="button" :disabled="disabled"
        class="group flex h-14 flex-1 items-center justify-center rounded-xl border-2 text-base font-semibold tracking-wide uppercase transition-all duration-300"
        :class="[
            disabled
                ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                : 'border-gray-900 bg-white text-gray-900 hover:-translate-y-0.5 hover:bg-gray-900 hover:text-white hover:shadow-lg active:scale-[0.98] cursor-pointer'
        ]">
        Buy Now

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