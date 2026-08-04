<template>

    <nav class="flex flex-wrap gap-2 border-b border-gray-200">

        <TabItem v-for="tab in tabs" :key="tab.id" :label="tab.label" />

    </nav>

</template>

<script setup>
import TabItem from "./tabItem.vue";

defineProps({
    tabs: {
        type: Array,
        default: () => [],
    },
});
</script>