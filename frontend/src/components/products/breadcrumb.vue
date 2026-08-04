<template>
    <nav aria-label="Breadcrumb" class="mb-8">
        <ol role="list" class="flex items-center space-x-2">
            <li v-for="(item, index) in items" :key="item.name" class="flex items-center">
                <RouterLink v-if="!item.current" :to="item.href"
                    class="text-sm font-medium text-gray-500 transition-colors duration-200 hover:text-gray-700">
                    {{ item.name }}
                </RouterLink>

                <span v-else class="text-sm font-medium text-gray-900" aria-current="page">
                    {{ item.name }}
                </span>

                <ChevronRightIcon v-if="index < items.length - 1" class="mx-2 h-4 w-4 text-gray-400"
                    aria-hidden="true" />

            </li>
        </ol>

    </nav>
</template>

<script setup>
import { ChevronRightIcon } from "@heroicons/vue/20/solid";
import { RouterLink } from "vue-router";

defineProps({

    items: {
        type: Array,
        default: () => [],
    },

});
</script>