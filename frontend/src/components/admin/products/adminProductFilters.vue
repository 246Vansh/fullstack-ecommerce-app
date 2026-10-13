<template>
    <div class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_10rem_14rem] md:items-end">

            <!-- Search runs on submit (Enter or the button), not on every keystroke. -->
            <form role="search" class="min-w-0" @submit.prevent="submitSearch">
                <label for="admin-product-search" class="block text-sm font-medium text-slate-700">
                    Search products
                </label>
                <div class="mt-1 flex gap-2">
                    <div class="relative min-w-0 flex-1">
                        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                            aria-hidden="true" />
                        <input id="admin-product-search" v-model="searchText" type="search" maxlength="100"
                            autocomplete="off" aria-describedby="admin-product-search-hint"
                            class="block w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-2 focus:outline-indigo-600"
                            placeholder="Name, brand, slug or SKU" />
                    </div>
                    <button type="submit"
                        class="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer">
                        Search
                    </button>
                </div>
                <p id="admin-product-search-hint" class="sr-only">Press Enter to search.</p>
            </form>

            <div>
                <label for="admin-product-status" class="block text-sm font-medium text-slate-700">Status</label>
                <select id="admin-product-status" :value="filters.status"
                    class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-2 focus:outline-indigo-600"
                    @change="$emit('change', { status: $event.target.value })">
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            <div>
                <label for="admin-product-category" class="block text-sm font-medium text-slate-700">Category</label>
                <select id="admin-product-category" :value="filters.category" :disabled="categoriesError"
                    :aria-describedby="categoriesError ? 'admin-product-category-error' : undefined"
                    class="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:outline-2 focus:outline-indigo-600 disabled:bg-slate-100 disabled:text-slate-500"
                    @change="$emit('change', { category: $event.target.value })">
                    <option value="">All categories</option>
                    <!-- A filter from the URL whose category is unknown stays selectable. -->
                    <option v-if="filters.category && !knownCategory" :value="filters.category">
                        Category #{{ filters.category }}
                    </option>
                    <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                        {{ option.isChild ? "  — " : "" }}{{ option.label }}{{ option.isActive ? "" : " (inactive)" }}
                    </option>
                </select>
                <p v-if="categoriesError" id="admin-product-category-error" class="mt-1 text-xs text-red-700">
                    Categories could not be loaded.
                </p>
            </div>

        </div>

        <div v-if="hasFilters" class="mt-3 flex justify-end">
            <button type="button"
                class="rounded text-sm font-medium text-indigo-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer"
                @click="$emit('clear')">
                Clear filters
            </button>
        </div>
    </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { MagnifyingGlassIcon } from "@heroicons/vue/20/solid";

const props = defineProps({
    filters: { type: Object, required: true },
    hasFilters: { type: Boolean, default: false },
    categoryOptions: { type: Array, default: () => [] },
    categoriesError: { type: Boolean, default: false },
});

const emit = defineEmits(["change", "clear"]);

// Local text until submitted; follows the URL (back/forward, Clear filters).
const searchText = ref(props.filters.search);
watch(() => props.filters.search, (value) => { searchText.value = value; });

const submitSearch = () => emit("change", { search: searchText.value.trim() });

const knownCategory = computed(() => props.categoryOptions.some((option) => option.value === props.filters.category));
</script>
