<template>
    <div class="rounded-card border border-slate-200 bg-white p-4 shadow-card">
        <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem] lg:grid-cols-[minmax(0,1fr)_11rem_15rem] md:items-end">

            <!-- Search runs on submit (Enter or the button), not on every keystroke. -->
            <form role="search" class="min-w-0 md:col-span-2 lg:col-span-1" @submit.prevent="submitSearch">
                <label for="admin-product-search" class="block text-sm font-medium text-slate-900">
                    Search products
                </label>
                <div class="mt-1.5 flex gap-2">
                    <div class="relative min-w-0 flex-1">
                        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                            aria-hidden="true" />
                        <input id="admin-product-search" v-model="searchText" type="search" maxlength="100"
                            autocomplete="off" aria-describedby="admin-product-search-hint"
                            :class="[CONTROL, 'pl-10 pr-3']"
                            placeholder="Name, brand, slug or SKU" />
                    </div>
                    <PrimaryButton tag="button" type="submit" class="shrink-0 px-4!">Search</PrimaryButton>
                </div>
                <p id="admin-product-search-hint" class="sr-only">Press Enter to search.</p>
            </form>

            <div>
                <label for="admin-product-status" class="block text-sm font-medium text-slate-900">Status</label>
                <select id="admin-product-status" :value="filters.status" :class="[CONTROL, 'mt-1.5 px-3']"
                    @change="$emit('change', { status: $event.target.value })">
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            <div>
                <label for="admin-product-category" class="block text-sm font-medium text-slate-900">Category</label>
                <select id="admin-product-category" :value="filters.category" :disabled="categoriesError"
                    :aria-describedby="categoriesError ? 'admin-product-category-error' : undefined"
                    :class="[CONTROL, 'mt-1.5 px-3']"
                    @change="$emit('change', { category: $event.target.value })">
                    <option value="">All categories</option>
                    <!-- A filter from the URL whose category is unknown stays selectable. -->
                    <option v-if="filters.category && !knownCategory" :value="filters.category">
                        Category #{{ filters.category }}
                    </option>
                    <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                        {{ option.isChild ? "  — " : "" }}{{ option.label }}{{ option.isActive ? "" : " (inactive)" }}
                    </option>
                </select>
                <p v-if="categoriesError" id="admin-product-category-error" class="mt-1.5 text-xs font-medium text-red-700">
                    Categories could not be loaded.
                </p>
            </div>

        </div>

        <div v-if="hasFilters" class="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p class="text-sm text-slate-600">Filters applied</p>
            <button type="button"
                class="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-brand hover:bg-brand-soft hover:text-brand-hover outline-brand focus-visible:outline-2 cursor-pointer"
                @click="$emit('clear')">
                <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                Clear filters
            </button>
        </div>
    </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/vue/20/solid";

import PrimaryButton from "@/components/ui/primaryButton.vue";

const props = defineProps({
    filters: { type: Object, required: true },
    hasFilters: { type: Boolean, default: false },
    categoryOptions: { type: Array, default: () => [] },
    categoriesError: { type: Boolean, default: false },
});

const emit = defineEmits(["change", "clear"]);

// Matches AdminField's controls (44px, brand focus ring, 16px text on phones).
const CONTROL = "block min-h-11 w-full rounded-control border border-slate-300 bg-white py-2 text-base text-slate-900 placeholder:text-slate-400 transition-colors duration-150 hover:border-slate-400 focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 sm:text-sm";

// Local text until submitted; follows the URL (back/forward, Clear filters).
const searchText = ref(props.filters.search);
watch(() => props.filters.search, (value) => { searchText.value = value; });

const submitSearch = () => emit("change", { search: searchText.value.trim() });

const knownCategory = computed(() => props.categoryOptions.some((option) => option.value === props.filters.category));
</script>
