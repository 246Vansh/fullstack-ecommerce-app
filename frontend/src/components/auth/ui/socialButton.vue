<template>

    <button type="button" class=" flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all duration-200 hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2
        " @click="$emit('click', provider)">

        <component :is="provider.icon" class="h-5 w-5" />

        <span>

            Continue with {{ provider.name }}

        </span>

    </button>

</template>

<script setup>
defineProps({

    provider: {
        type: Object,
        required: true,
    },

});

defineEmits([
    "click",
]);
</script>