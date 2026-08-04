<template>
    <nav class="border-b border-gray-200">
        <ul class="flex flex-wrap gap-8">

            <li v-for="tab in tabs" :key="tab.id">
                <button type="button" class="relative pb-4 text-sm font-medium transition-colors duration-200 cursor-pointer" :class="[
                    activeTab === tab.id
                        ? 'text-gray-900'
                        : 'text-gray-500 hover:text-gray-900'
                ]" @click="$emit('change-tab', tab.id)">
                    {{ tab.label }}

                    <span v-if="activeTab === tab.id" class="absolute bottom-0 left-0 h-0.5 w-full bg-gray-900" />
                </button>
            </li>

        </ul>
    </nav>
</template>

<script setup>
defineProps({
    tabs: {
        type: Array,
        required: true,
    },

    activeTab: {
        type: String,
        required: true,
    },
});

defineEmits(["change-tab"]);
</script>