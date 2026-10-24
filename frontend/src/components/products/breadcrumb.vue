<template>
    <!-- Items are { name, href } links, with the last one { name, current: true }. -->
    <nav v-if="items.length" aria-label="Breadcrumb">
        <ol role="list" class="flex min-w-0 flex-wrap items-center gap-y-1 text-sm">
            <li v-for="(item, index) in items" :key="index" class="flex min-w-0 items-center">
                <RouterLink v-if="!item.current" :to="item.href"
                    class="rounded-sm font-medium text-slate-500 transition-colors duration-200 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                    {{ item.name }}
                </RouterLink>

                <span v-else class="max-w-[16rem] truncate font-medium text-slate-900 sm:max-w-md" aria-current="page">
                    {{ item.name }}
                </span>

                <ChevronRightIcon v-if="index < items.length - 1" class="mx-1.5 h-4 w-4 shrink-0 text-slate-400"
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
