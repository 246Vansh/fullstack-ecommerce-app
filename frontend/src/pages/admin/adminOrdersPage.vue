<template>
    <div class="mx-auto max-w-7xl">

        <AdminPageHeader title="Orders" description="Every customer order, newest first. Open one to move it forward." />

        <!-- Toolbar: status filter + selected status. Stays usable on the 403 screen,
             so a later successful load can clear it. -->
        <div class="mt-6 flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-card sm:flex-row sm:items-end sm:justify-between">
            <div class="sm:w-60">
                <label for="order-status-filter" class="block text-sm font-medium text-slate-900">Status</label>
                <select id="order-status-filter" :value="status"
                    class="mt-1.5 block min-h-11 w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 transition-colors duration-150 hover:border-slate-400 focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/20 sm:text-sm"
                    @change="setStatus($event.target.value)">
                    <option value="">All statuses</option>
                    <option v-for="value in STATUSES" :key="value" :value="value">{{ statusLabel(value) }}</option>
                </select>
            </div>
            <div v-if="status" class="flex items-center gap-2 text-sm text-slate-600 sm:pb-2.5">
                Showing <AdminOrderStatus :status="status" /> orders
                <button type="button"
                    class="inline-flex min-h-9 items-center rounded-md px-2 font-semibold text-brand hover:bg-brand-soft hover:text-brand-hover outline-brand focus-visible:outline-2 cursor-pointer"
                    @click="setStatus('')">
                    Show all
                </button>
            </div>
        </div>

        <!-- Access revoked server-side (403). -->
        <AdminStatePanel v-if="forbidden" kind="forbidden" class="mt-4" title="Admin access required"
            message="The server did not accept your account as an administrator. If your access changed recently, sign out and sign in again." />

        <template v-else>

            <!-- Announces load results without moving focus -->
            <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>

            <!-- First load: nothing to show yet -->
            <AdminStatePanel v-if="loading && !pagination" kind="loading" class="mt-4" title="Loading orders" />

            <!-- Error -->
            <AdminStatePanel v-else-if="error" kind="error" class="mt-4" title="Orders unavailable" :message="error">
                <PrimaryButton tag="button" variant="outline" :loading="loading" @click="load">
                    {{ loading ? "Retrying…" : "Try again" }}
                </PrimaryButton>
            </AdminStatePanel>

            <!-- Empty -->
            <AdminStatePanel v-else-if="!orders.length" kind="empty" class="mt-4" :icon="ClipboardDocumentListIcon" title="No orders"
                :message="status ? `No orders are ${statusLabel(status).toLowerCase()}.` : 'Orders will appear here once customers place them.'">
                <PrimaryButton v-if="status" tag="button" variant="outline" @click="setStatus('')">Show all orders</PrimaryButton>
            </AdminStatePanel>

            <!-- List (kept on screen, dimmed, while the next page loads) -->
            <section v-else class="mt-4" :aria-busy="loading" aria-labelledby="admin-orders-range">

                <p id="admin-orders-range" tabindex="-1" class="mb-3 text-sm text-slate-600 focus:outline-none">
                    {{ rangeText }}
                </p>

                <div class="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-opacity"
                    :class="{ 'pointer-events-none opacity-60': loading }">

                    <!-- Column headings for the row grid (visual only; each row's link names its fields). -->
                    <div aria-hidden="true" :class="[GRID, 'hidden border-b border-slate-200 bg-slate-50 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 lg:grid']">
                        <span>Order</span>
                        <span>Customer</span>
                        <span>Payment</span>
                        <span>Status</span>
                        <span class="text-right">Total</span>
                        <span></span>
                    </div>

                    <ul class="divide-y divide-slate-100">
                        <li v-for="order in orders" :key="order.id">
                            <RouterLink :to="{ name: 'admin-order-detail', params: { id: order.id } }"
                                :class="[GRID, 'group grid grid-cols-[minmax(0,1fr)_auto] gap-y-2 py-4 transition-colors hover:bg-slate-50 outline-brand focus-visible:outline-2 focus-visible:-outline-offset-2 lg:items-center']">

                                <!-- Order -->
                                <div class="min-w-0">
                                    <p class="wrap-anywhere font-semibold text-slate-900 group-hover:text-brand">Order #{{ order.orderNumber }}</p>
                                    <p class="text-sm text-slate-600">
                                        {{ formatDate(order.createdAt, true) }}
                                        <span class="text-slate-400" aria-hidden="true">·</span>
                                        {{ order.itemCount }} {{ order.itemCount === 1 ? "item" : "items" }}
                                    </p>
                                </div>

                                <!-- Status + total: top-right on phones/tablets -->
                                <div class="flex flex-col items-end gap-1.5 lg:hidden">
                                    <span class="font-semibold tabular-nums text-slate-900">{{ formatPrice(order.total, order.currency) }}</span>
                                    <AdminOrderStatus :status="order.status" />
                                </div>

                                <!-- Customer -->
                                <div class="col-span-2 min-w-0 text-sm lg:col-span-1">
                                    <p class="truncate font-medium text-slate-900">{{ order.customer.name }}</p>
                                    <p class="truncate text-slate-600">{{ order.customer.email }}</p>
                                </div>

                                <!-- Payment -->
                                <p class="col-span-2 text-sm text-slate-600 lg:col-span-1">
                                    <span class="lg:hidden">Payment: </span>
                                    <span class="font-medium text-slate-900">{{ paymentStatusLabel(order.paymentStatus) }}</span>
                                    <template v-if="order.paymentMethod">
                                        <span class="block text-xs text-slate-500 max-lg:inline max-lg:text-sm">
                                            <span class="lg:hidden"> · </span>{{ paymentMethodLabel(order.paymentMethod) }}
                                        </span>
                                    </template>
                                </p>

                                <!-- Desktop columns -->
                                <div class="hidden lg:block"><AdminOrderStatus :status="order.status" /></div>
                                <span class="hidden text-right font-semibold tabular-nums text-slate-900 lg:block">
                                    {{ formatPrice(order.total, order.currency) }}
                                </span>
                                <ChevronRightIcon class="hidden h-5 w-5 justify-self-end text-slate-400 group-hover:text-brand lg:block" aria-hidden="true" />

                            </RouterLink>
                        </li>
                    </ul>
                </div>

                <Pagination v-if="pagination.totalPages > 1" class="mt-2" :model-value="pagination.page"
                    :total-pages="pagination.totalPages" @update:model-value="goToPage" />

            </section>

        </template>

    </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ChevronRightIcon, ClipboardDocumentListIcon } from "@heroicons/vue/24/outline";

import AdminOrderStatus from "@/components/admin/ui/adminOrderStatus.vue";
import AdminPageHeader from "@/components/admin/ui/adminPageHeader.vue";
import AdminStatePanel from "@/components/admin/ui/adminStatePanel.vue";
import Pagination from "@/components/products/pagination.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";

import { adminOrderService } from "@/services/adminOrderService";
import { parseApiError } from "@/services/apiClient";
import { formatDate, formatPrice, paymentMethodLabel, paymentStatusLabel, statusLabel } from "@/composables/useOrderSuccess";

// Matches the OrderStatus enum (and the API's ?status= values).
const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const PAGE_SIZE = 20;

// Shared by the column headings and each row (desktop); rows restack below lg.
const GRID = "gap-x-4 px-4 sm:px-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)_8rem_7.5rem_1.25rem]";
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
    forbidden.value = false;

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
