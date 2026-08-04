<template>
    <div class="relative my-8">

        <div class="absolute inset-0 flex items-center">

            <div class="w-full border-t border-gray-200" />

        </div>

        <div class="relative flex justify-center">

            <span class="bg-white px-4 text-sm text-gray-500">
                {{ text }}
            </span>

        </div>

    </div>
</template>

<script setup>
defineProps({

    text: {
        type: String,
        default: "Or continue with",
    },

});
</script>