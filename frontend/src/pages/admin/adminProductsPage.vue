<template>
    <div class="mx-auto max-w-7xl">

        <AdminPageHeader title="Products" description="Every product in the catalog, including inactive ones hidden from the store.">
            <template #actions>
                <PrimaryButton :to="{ name: 'admin-product-new' }" class="w-full sm:w-auto">
                    <PlusIcon class="-ml-1 h-5 w-5" aria-hidden="true" />
                    Add product
                </PrimaryButton>
            </template>
        </AdminPageHeader>

        <!-- Access revoked server-side (403): filters would not help. -->
        <AdminStatePanel v-if="forbidden" kind="forbidden" class="mt-6" title="Admin access required"
            message="The server did not accept your account as an administrator. If your access changed recently, sign out and sign in again.">
            <PrimaryButton :to="ROUTES.HOME" variant="outline">Back to the store</PrimaryButton>
        </AdminStatePanel>

        <template v-else>

            <AdminProductFilters class="mt-6" :filters="filters" :has-filters="hasFilters"
                :category-options="categoryOptions" :categories-error="categoriesError"
                @change="setFilters" @clear="clearFilters" />

            <!-- Announces load results without moving focus -->
            <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>

            <!-- First load: nothing to show yet -->
            <AdminStatePanel v-if="loading && !pagination" kind="loading" class="mt-4" title="Loading products" />

            <!-- Error -->
            <AdminStatePanel v-else-if="error" kind="error" class="mt-4" title="Products unavailable" :message="error">
                <PrimaryButton tag="button" variant="outline" :loading="loading" @click="retry">
                    {{ loading ? "Retrying…" : "Try again" }}
                </PrimaryButton>
            </AdminStatePanel>

            <!-- Empty -->
            <AdminStatePanel v-else-if="!products.length && hasFilters" kind="empty" class="mt-4"
                title="No matching products" message="Try a different search or clear the filters.">
                <PrimaryButton tag="button" variant="outline" @click="clearFilters">Clear filters</PrimaryButton>
            </AdminStatePanel>
            <AdminStatePanel v-else-if="!products.length" kind="empty" class="mt-4" :icon="CubeIcon"
                title="No products yet" message="Products you add will appear here.">
                <PrimaryButton :to="{ name: 'admin-product-new' }">Add product</PrimaryButton>
            </AdminStatePanel>

            <!-- Results (kept on screen, dimmed, while the next page/filter loads) -->
            <section v-else class="mt-4" :aria-busy="loading" aria-labelledby="admin-products-count">
                <div class="mb-3 flex min-h-6 items-center gap-2">
                    <p id="admin-products-count" class="text-sm text-slate-600">{{ rangeText }}</p>
                    <LoadingSpinner v-if="loading" class="h-4 w-4 text-slate-400 [&>svg]:h-4 [&>svg]:w-4" />
                </div>

                <div class="transition-opacity" :class="{ 'pointer-events-none opacity-60': loading }">
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
import { PlusIcon } from "@heroicons/vue/20/solid";
import { CubeIcon } from "@heroicons/vue/24/outline";

import AdminPageHeader from "@/components/admin/ui/adminPageHeader.vue";
import AdminStatePanel from "@/components/admin/ui/adminStatePanel.vue";
import AdminProductFilters from "@/components/admin/products/adminProductFilters.vue";
import AdminProductList from "@/components/admin/products/adminProductList.vue";
import Pagination from "@/components/products/pagination.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";

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
