<template>
    <div class="mx-auto max-w-7xl">

        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 class="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Orders</h1>
                <p class="mt-1 text-sm text-slate-500">Every customer order, newest first. Open one to move it forward.</p>
            </div>

            <div>
                <label for="order-status-filter" class="block text-sm font-medium text-slate-700">Status</label>
                <select id="order-status-filter" :value="status"
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:w-52"
                    @change="setStatus($event.target.value)">
                    <option value="">All statuses</option>
                    <option v-for="value in STATUSES" :key="value" :value="value">{{ statusLabel(value) }}</option>
                </select>
            </div>
        </div>

        <!-- Access revoked server-side (403). -->
        <section v-if="forbidden"
            class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-white px-4 text-center">
            <h2 class="text-xl font-bold text-slate-900">Admin access required</h2>
            <p class="mt-2 max-w-md text-slate-500">
                The server did not accept your account as an administrator. If your access changed recently,
                sign out and sign in again.
            </p>
        </section>

        <template v-else>

            <!-- Announces load results without moving focus -->
            <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>

            <!-- First load: nothing to show yet -->
            <section v-if="loading && !pagination"
                class="mt-6 flex min-h-60 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
                <LoadingSpinner class="text-slate-400" label="Loading orders" />
            </section>

            <!-- Error -->
            <section v-else-if="error"
                class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center">
                <h2 class="text-xl font-bold text-slate-900">Orders unavailable</h2>
                <p class="mt-2 text-slate-500">{{ error }}</p>
                <button type="button" :disabled="loading"
                    class="mt-6 rounded-lg border border-slate-200 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 cursor-pointer"
                    @click="load">
                    {{ loading ? "Retrying…" : "Try again" }}
                </button>
            </section>

            <!-- Empty -->
            <section v-else-if="!orders.length"
                class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center">
                <h2 class="text-xl font-bold text-slate-900">No orders</h2>
                <p class="mt-2 text-slate-500">
                    {{ status ? `No orders are ${statusLabel(status).toLowerCase()}.` : "Orders will appear here once customers place them." }}
                </p>
            </section>

            <!-- List (kept on screen, dimmed, while the next page loads) -->
            <section v-else class="mt-6" :aria-busy="loading" aria-labelledby="admin-orders-range">

                <p id="admin-orders-range" tabindex="-1" class="mb-3 text-sm text-slate-600 focus:outline-none">
                    {{ rangeText }}
                </p>

                <ul class="space-y-3" :class="{ 'pointer-events-none opacity-60 transition-opacity': loading }">
                    <li v-for="order in orders" :key="order.id">
                        <RouterLink :to="{ name: 'admin-order-detail', params: { id: order.id } }"
                            class="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-600 sm:flex-row sm:items-center sm:justify-between">

                            <div class="min-w-0">
                                <p class="wrap-anywhere font-bold text-slate-900">Order #{{ order.orderNumber }}</p>
                                <p class="mt-1 wrap-anywhere text-sm text-slate-500">
                                    {{ order.customer.name }} · {{ order.customer.email }}
                                </p>
                                <p class="text-sm text-slate-500">
                                    {{ formatDate(order.createdAt, true) }} ·
                                    {{ order.itemCount }} {{ order.itemCount === 1 ? "item" : "items" }} ·
                                    Payment: {{ paymentStatusLabel(order.paymentStatus) }}
                                </p>
                            </div>

                            <div class="flex items-center gap-4 sm:shrink-0">
                                <OrderStatusBadge :status="order.status" />
                                <span class="font-bold text-slate-900">{{ formatPrice(order.total) }}</span>
                                <ChevronRightIcon class="ml-auto h-5 w-5 text-slate-400 sm:ml-0" aria-hidden="true" />
                            </div>

                        </RouterLink>
                    </li>
                </ul>

                <Pagination v-if="pagination.totalPages > 1" class="mt-2" :model-value="pagination.page"
                    :total-pages="pagination.totalPages" @update:model-value="goToPage" />

            </section>

        </template>

    </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ChevronRightIcon } from "@heroicons/vue/24/outline";

import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import OrderStatusBadge from "@/components/orders/orderStatusBadge.vue";
import Pagination from "@/components/products/pagination.vue";

import { adminOrderService } from "@/services/adminOrderService";
import { parseApiError } from "@/services/apiClient";
import { formatDate, formatPrice, paymentStatusLabel, statusLabel } from "@/composables/useOrderSuccess";

// Matches the OrderStatus enum (and the API's ?status= values).
const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const PAGE_SIZE = 20;
const MAX_PAGE = 10_000;

const route = useRoute();
const router = useRouter();

// The URL is the source of truth (?status=SHIPPED&page=2), so reload and
// back/forward work. Malformed values fall back instead of reaching the API.
const status = computed(() => (STATUSES.includes(route.query.status) ? route.query.status : ""));
const page = computed(() => {
    const value = typeof route.query.page === "string" ? route.query.page : "";
    return /^[1-9]\d{0,4}$/.test(value) && Number(value) <= MAX_PAGE ? Number(value) : 1;
});

const orders = ref([]);
const pagination = ref(null);
const loading = ref(true);
const error = ref("");
const forbidden = ref(false);

let focusRangeAfterLoad = false;

// Only the newest request may update the list.
let latestRequest = 0;

async function load() {
    const request = ++latestRequest;
    const current = page.value;

    loading.value = true;
    error.value = "";

    try {
        const result = await adminOrderService.listOrders({ page: current, limit: PAGE_SIZE, status: status.value || undefined });

        if (request !== latestRequest) return;

        // Past the last page: show the last page instead of an empty one.
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
            document.getElementById("admin-orders-range")?.focus();
        }
    } catch (err) {
        if (request !== latestRequest) return;

        const { status: code, message } = parseApiError(err);
        forbidden.value = code === 403;
        error.value = message;
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

// A new filter starts at page 1.
function setStatus(value) {
    const query = { ...route.query };
    delete query.page;
    if (value) query.status = value;
    else delete query.status;

    router.push({ query });
}

const rangeText = computed(() => {
    if (!pagination.value || !orders.value.length) return "";

    const { page: current, limit, total, totalPages } = pagination.value;
    const first = (current - 1) * limit + 1;
    const last = first + orders.value.length - 1;
    const range = `Showing ${first}–${last} of ${total} ${total === 1 ? "order" : "orders"}`;

    return totalPages > 1 ? `${range} · Page ${current} of ${totalPages}` : range;
});

const liveMessage = computed(() => {
    if (loading.value) return "Loading orders";
    if (error.value) return `Orders unavailable. ${error.value}`;
    if (!orders.value.length) return "No orders";
    return rangeText.value;
});

watch(() => route.query, () => {
    if (route.name === "admin-orders") load();
}, { immediate: true });
</script>
