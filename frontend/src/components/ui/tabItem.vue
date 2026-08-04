<template>

    <button type="button"
        class="border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-all duration-200 hover:border-gray-900 hover:text-gray-900">
        {{ label }}
    </button>

</template>

<script setup>
defineProps({
    label: {
        type: String,
        required: true,
    },
});
</script>