<template>

    <Header />

    <main id="main-content" tabindex="-1" class="bg-slate-50">

        <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6">

            <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">
                My Orders
            </h1>

            <!-- Announces load results without moving focus -->
            <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>

            <!-- First load: nothing to show yet -->
            <section v-if="loading && !pagination"
                class="mt-6 flex min-h-60 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
                <LoadingSpinner class="text-gray-400" label="Loading your orders" />
            </section>

            <!-- Error -->
            <section v-else-if="error"
                class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-4 text-center">
                <h2 class="text-xl font-bold text-gray-900">Orders unavailable</h2>
                <p class="mt-2 text-gray-500">{{ error }}</p>
                <button type="button" :disabled="loading"
                    class="mt-6 rounded-xl border border-gray-200 px-6 py-3 font-semibold text-slate-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                    @click="load">
                    {{ loading ? "Retrying…" : "Try again" }}
                </button>
            </section>

            <!-- Empty -->
            <section v-else-if="!orders.length"
                class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-4 text-center">
                <h2 class="text-xl font-bold text-gray-900">No orders yet</h2>
                <p class="mt-2 text-gray-500">Orders you place will appear here.</p>
                <RouterLink to="/products"
                    class="mt-6 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">
                    Shop Products
                </RouterLink>
            </section>

            <!-- List (kept on screen, dimmed, while the next page loads) -->
            <section v-else class="mt-6" :aria-busy="loading" aria-labelledby="orders-range">

                <p id="orders-range" tabindex="-1" class="mb-3 text-sm text-slate-600 focus:outline-none">
                    {{ rangeText }}
                </p>

                <ul class="space-y-4" :class="{ 'pointer-events-none opacity-60 transition-opacity': loading }">
                    <li v-for="order in orders" :key="order.id">
                        <RouterLink :to="{ name: 'order-details', params: { id: order.id } }"
                            class="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center sm:justify-between">

                            <div class="min-w-0">
                                <p class="wrap-anywhere font-bold text-slate-900">
                                    Order #{{ order.orderNumber }}
                                </p>
                                <p class="mt-1 text-sm text-slate-500">
                                    {{ formatDate(order.createdAt) }} ·
                                    {{ order.itemCount }} {{ order.itemCount === 1 ? "item" : "items" }}
                                </p>
                            </div>

                            <div class="flex items-center gap-4 sm:shrink-0">
                                <OrderStatusBadge :status="order.status" />
                                <span class="font-bold text-slate-900">{{ formatPrice(order.total) }}</span>
                                <ChevronRightIcon class="ml-auto h-5 w-5 text-slate-400 sm:ml-0" />
                            </div>

                        </RouterLink>
                    </li>
                </ul>

                <Pagination v-if="pagination.totalPages > 1" class="mt-2" :model-value="pagination.page"
                    :total-pages="pagination.totalPages" @update:model-value="goToPage" />

            </section>

        </div>

    </main>

    <Footer />

</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ChevronRightIcon } from "@heroicons/vue/24/outline";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import OrderStatusBadge from "@/components/orders/orderStatusBadge.vue";
import Pagination from "@/components/products/pagination.vue";

import { orderService } from "@/services/orderService";
import { parseApiError } from "@/services/apiClient";
import { formatDate, formatPrice } from "@/composables/useOrderSuccess";

// Matches the API's default; the server caps limit at 50 and page at 10000.
const PAGE_SIZE = 10;
const MAX_PAGE = 10_000;

const route = useRoute();
const router = useRouter();

// The URL is the source of truth (?page=2), so reload and back/forward work.
// A malformed page falls back to 1 instead of reaching the API as a 422.
const page = computed(() => {
    const value = typeof route.query.page === "string" ? route.query.page : "";
    return /^[1-9]\d{0,4}$/.test(value) && Number(value) <= MAX_PAGE ? Number(value) : 1;
});

const orders = ref([]);
const pagination = ref(null);
const loading = ref(true);
const error = ref("");

// Set by the page controls: the page scrolls to the top, so focus follows it.
let focusRangeAfterLoad = false;

// Only the newest request may update the list; a slow earlier page is ignored.
let latestRequest = 0;

async function load() {
    const request = ++latestRequest;
    const current = page.value;

    loading.value = true;
    error.value = "";

    try {
        const result = await orderService.listOrders({ page: current, limit: PAGE_SIZE });

        if (request !== latestRequest) return;

        // Past the last page (a stale link, or orders on another device):
        // show the last page instead of an empty one.
        const { totalPages } = result.pagination;

        if (!result.orders.length && current > 1 && totalPages > 0) {
            goToPage(totalPages, { replace: true });
            return;
        }

        orders.value = result.orders;
        pagination.value = result.pagination;

        if (focusRangeAfterLoad) {
            focusRangeAfterLoad = false;
            await nextTick();
            document.getElementById("orders-range")?.focus();
        }
    } catch (err) {
        if (request !== latestRequest) return;

        error.value = parseApiError(err).message;
    } finally {
        if (request === latestRequest) loading.value = false;
    }
}

function goToPage(next, { replace = false } = {}) {
    if (!replace) focusRangeAfterLoad = true;

    const query = { ...route.query };
    if (next > 1) query.page = String(next);
    else delete query.page;

    return replace ? router.replace({ query }) : router.push({ query });
}

// "Showing 11–20 of 34 orders · Page 2 of 4"
const rangeText = computed(() => {
    if (!pagination.value || !orders.value.length) return "";

    const { page: current, limit, total, totalPages } = pagination.value;
    const first = (current - 1) * limit + 1;
    const last = first + orders.value.length - 1;
    const range = `Showing ${first}–${last} of ${total} ${total === 1 ? "order" : "orders"}`;

    return totalPages > 1 ? `${range} · Page ${current} of ${totalPages}` : range;
});

const liveMessage = computed(() => {
    if (loading.value) return "Loading your orders";
    if (error.value) return `Orders unavailable. ${error.value}`;
    if (!orders.value.length) return "No orders yet";
    return rangeText.value;
});

// Reload whenever this page's query changes (not when leaving the page).
watch(() => route.query, () => {
    if (route.name === "orders") load();
}, { immediate: true });
</script>
