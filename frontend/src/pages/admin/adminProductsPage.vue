<template>
    <div class="mx-auto max-w-7xl">

        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 class="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Products</h1>
                <p class="mt-1 text-sm text-slate-500">All products, including inactive ones hidden from the store.</p>
            </div>
            <RouterLink :to="{ name: 'admin-product-new' }"
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                <PlusIcon class="h-5 w-5" aria-hidden="true" />
                Add product
            </RouterLink>
        </div>

        <!-- Access revoked server-side (403): filters would not help. -->
        <section v-if="forbidden"
            class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-white px-4 text-center">
            <h2 class="text-xl font-bold text-slate-900">Admin access required</h2>
            <p class="mt-2 max-w-md text-slate-500">
                The server did not accept your account as an administrator. If your access changed recently,
                sign out and sign in again.
            </p>
            <RouterLink :to="ROUTES.HOME"
                class="mt-6 rounded-lg border border-slate-200 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
                Back to the store
            </RouterLink>
        </section>

        <template v-else>

            <AdminProductFilters class="mt-6" :filters="filters" :has-filters="hasFilters"
                :category-options="categoryOptions" :categories-error="categoriesError"
                @change="setFilters" @clear="clearFilters" />

            <!-- Announces load results without moving focus -->
            <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>

            <!-- First load: nothing to show yet -->
            <section v-if="loading && !pagination"
                class="mt-6 flex min-h-60 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
                <LoadingSpinner class="text-slate-400" label="Loading products" />
            </section>

            <!-- Error -->
            <section v-else-if="error"
                class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center">
                <h2 class="text-xl font-bold text-slate-900">Products unavailable</h2>
                <p class="mt-2 text-slate-500">{{ error }}</p>
                <button type="button" :disabled="loading"
                    class="mt-6 rounded-lg border border-slate-200 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 cursor-pointer"
                    @click="retry">
                    {{ loading ? "Retrying…" : "Try again" }}
                </button>
            </section>

            <!-- Empty -->
            <section v-else-if="!products.length"
                class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center">
                <template v-if="hasFilters">
                    <h2 class="text-xl font-bold text-slate-900">No matching products</h2>
                    <p class="mt-2 text-slate-500">Try a different search or clear the filters.</p>
                    <button type="button"
                        class="mt-6 rounded-lg border border-slate-200 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer"
                        @click="clearFilters">
                        Clear filters
                    </button>
                </template>
                <template v-else>
                    <h2 class="text-xl font-bold text-slate-900">No products yet</h2>
                    <p class="mt-2 text-slate-500">Products you add will appear here.</p>
                </template>
            </section>

            <!-- Results (kept on screen, dimmed, while the next page/filter loads) -->
            <section v-else class="mt-6" :aria-busy="loading" aria-labelledby="admin-products-count">
                <p id="admin-products-count" class="mb-3 text-sm text-slate-600">{{ rangeText }}</p>

                <div :class="{ 'pointer-events-none opacity-60 transition-opacity': loading }">
                    <AdminProductList :products="products" :caption="rangeText" />
                </div>

                <Pagination v-if="pagination.totalPages > 1" class="mt-2" :model-value="pagination.page"
                    :total-pages="pagination.totalPages" @update:model-value="(page) => setFilters({ page })" />
            </section>

        </template>

    </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { PlusIcon } from "@heroicons/vue/20/solid";

import AdminProductFilters from "@/components/admin/products/adminProductFilters.vue";
import AdminProductList from "@/components/admin/products/adminProductList.vue";
import Pagination from "@/components/products/pagination.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";

import { ROUTES } from "@/config";
import { useAdminProducts } from "@/composables/useAdminProducts";

const {
    filters,
    hasFilters,
    products,
    pagination,
    loading,
    error,
    forbidden,
    categoryOptions,
    categoriesError,
    setFilters,
    clearFilters,
    retry,
} = useAdminProducts();

// "Showing 21–40 of 57 products"
const rangeText = computed(() => {
    if (!pagination.value) return "";

    const { page, limit, total } = pagination.value;
    const first = (page - 1) * limit + 1;
    const last = first + products.value.length - 1;

    return `Showing ${first}–${last} of ${total} ${total === 1 ? "product" : "products"}`;
});

const liveMessage = computed(() => {
    if (loading.value) return "Loading products";
    if (forbidden.value) return "Admin access required";
    if (error.value) return `Products unavailable. ${error.value}`;
    if (!products.value.length) return "No products found";
    return rangeText.value;
});
</script>
