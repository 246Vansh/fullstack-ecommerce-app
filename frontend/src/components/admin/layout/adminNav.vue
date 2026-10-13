<template>
    <nav :id="navId" aria-label="Admin">
        <ul class="space-y-1">
            <li v-for="item in ITEMS" :key="item.label">
                <RouterLink :to="item.to" :aria-current="isActive(item) ? 'page' : undefined"
                    class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-600"
                    :class="isActive(item)
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'"
                    @click="$emit('navigate')">
                    <component :is="item.icon" class="h-5 w-5 shrink-0" aria-hidden="true" />
                    {{ item.label }}
                </RouterLink>
            </li>
        </ul>
    </nav>
</template>

<script setup>
import { RouterLink, useRoute } from "vue-router";
import { CubeIcon, FolderIcon } from "@heroicons/vue/24/outline";

defineProps({
    // Set on the mobile drawer's copy only (the menu button's aria-controls).
    navId: { type: String, default: undefined },
});

defineEmits(["navigate"]);

// Only sections that exist; others are added with their pages.
const ITEMS = [
    { label: "Products", to: { name: "admin-products" }, icon: CubeIcon, section: "admin-product" },
    { label: "Categories", to: { name: "admin-categories" }, icon: FolderIcon, section: "admin-categories" },
];

const route = useRoute();

// Products stays highlighted on its new/edit pages too.
const isActive = (item) => String(route.name ?? "").startsWith(item.section);
</script>
