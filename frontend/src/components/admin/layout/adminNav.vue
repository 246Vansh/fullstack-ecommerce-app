<template>
    <nav :id="navId" aria-label="Admin">
        <div v-for="group in GROUPS" :key="group.label" class="mb-6 last:mb-0">
            <p :id="`${idBase}-${group.label.toLowerCase()}`" class="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {{ group.label }}
            </p>
            <ul class="mt-2 space-y-1" :aria-labelledby="`${idBase}-${group.label.toLowerCase()}`">
                <li v-for="item in group.items" :key="item.label">
                    <RouterLink :to="item.to" :aria-current="isActive(item) ? 'page' : undefined"
                        class="group relative flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors outline-brand focus-visible:outline-2 focus-visible:outline-offset-2"
                        :class="isActive(item)
                            ? 'bg-brand-soft text-brand'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'"
                        @click="$emit('navigate')">
                        <span v-if="isActive(item)" class="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" aria-hidden="true"></span>
                        <component :is="item.icon" class="h-5 w-5 shrink-0"
                            :class="isActive(item) ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600'" aria-hidden="true" />
                        {{ item.label }}
                    </RouterLink>
                </li>
            </ul>
        </div>
    </nav>
</template>

<script setup>
import { RouterLink, useRoute } from "vue-router";
import { ClipboardDocumentListIcon, CubeIcon, FolderIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
    // Set on the mobile drawer's copy only (the menu button's aria-controls).
    navId: { type: String, default: undefined },
});

defineEmits(["navigate"]);

// Two copies render (sidebar and drawer), so group label ids need their own prefix.
const idBase = props.navId ?? "admin-nav";

// Only sections that exist; others are added with their pages.
const GROUPS = [
    {
        label: "Catalog",
        items: [
            { label: "Products", to: { name: "admin-products" }, icon: CubeIcon, section: "admin-product" },
            { label: "Categories", to: { name: "admin-categories" }, icon: FolderIcon, section: "admin-categories" },
        ],
    },
    {
        label: "Sales",
        items: [
            { label: "Orders", to: { name: "admin-orders" }, icon: ClipboardDocumentListIcon, section: "admin-order" },
        ],
    },
];

const route = useRoute();

// Products stays highlighted on its new/edit pages too.
const isActive = (item) => String(route.name ?? "").startsWith(item.section);
</script>
