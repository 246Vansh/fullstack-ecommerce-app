<template>
    <div class="mx-auto max-w-5xl">

        <RouterLink :to="{ name: 'admin-orders' }" class="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <span aria-hidden="true">←</span> All orders
        </RouterLink>

        <!-- Loading -->
        <section v-if="loading && !order"
            class="mt-4 flex min-h-60 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
            <LoadingSpinner class="text-slate-400" label="Loading order" />
        </section>

        <!-- Error / not found -->
        <section v-else-if="!order"
            class="mt-4 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center">
            <h1 class="text-2xl font-bold text-slate-900">Order unavailable</h1>
            <p class="mt-2 text-slate-500">{{ error }}</p>
            <button v-if="!notFound" type="button"
                class="mt-6 rounded-lg border border-slate-200 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer"
                @click="load(route.params.id)">
                Try again
            </button>
        </section>

        <template v-else>

            <!-- Summary + fulfilment -->
            <section class="mt-4 rounded-xl bg-white p-5 shadow-sm sm:p-6">

                <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div class="min-w-0">
                        <h1 class="wrap-anywhere text-2xl font-extrabold text-slate-900">Order #{{ order.orderNumber }}</h1>
                        <p class="mt-1 text-sm text-slate-500">Placed {{ formatDate(order.placedAt ?? order.createdAt, true) }}</p>
                    </div>
                    <OrderStatusBadge :status="order.status" class="self-start" />
                </div>

                <dl class="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                    <div>
                        <dt class="text-slate-500">Payment</dt>
                        <dd class="mt-1 font-semibold text-slate-900">{{ paymentStatusLabel(order.paymentStatus) }}</dd>
                    </div>
                    <div v-if="order.shippedAt">
                        <dt class="text-slate-500">Shipped</dt>
                        <dd class="mt-1 font-semibold text-slate-900">{{ formatDate(order.shippedAt, true) }}</dd>
                    </div>
                    <div v-if="order.deliveredAt">
                        <dt class="text-slate-500">Delivered</dt>
                        <dd class="mt-1 font-semibold text-slate-900">{{ formatDate(order.deliveredAt, true) }}</dd>
                    </div>
                </dl>

                <!-- Next fulfilment step (the server enforces the order of steps) -->
                <div class="mt-6 border-t border-slate-100 pt-5">

                    <p v-if="!order.nextStatus" class="text-sm text-slate-500">
                        {{ order.status === "DELIVERED" ? "This order has been delivered." : "This order no longer changes status." }}
                    </p>

                    <template v-else>
                        <button v-if="!confirming" id="advance-order" type="button"
                            class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer"
                            @click="openConfirm">
                            Mark as {{ statusLabel(order.nextStatus).toLowerCase() }}
                        </button>

                        <div v-else role="alertdialog" aria-labelledby="advance-heading" aria-describedby="advance-note"
                            class="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                            <p id="advance-heading" class="font-semibold text-slate-900">
                                Mark this order as {{ statusLabel(order.nextStatus).toLowerCase() }}?
                            </p>
                            <p id="advance-note" class="mt-1 text-sm text-slate-600">
                                The customer will see the new status. This step cannot be undone.
                            </p>
                            <div class="mt-4 flex flex-wrap gap-3">
                                <button type="button" :disabled="saving"
                                    class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                                    @click="advance">
                                    {{ saving ? "Saving..." : `Yes, mark as ${statusLabel(order.nextStatus).toLowerCase()}` }}
                                </button>
                                <button id="keep-status" type="button" :disabled="saving"
                                    class="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                                    @click="closeConfirm">
                                    Not now
                                </button>
                            </div>
                        </div>
                    </template>

                    <p v-if="actionError" role="alert" class="mt-4 text-sm font-medium text-red-600">{{ actionError }}</p>
                    <p v-else-if="actionDone" role="status" class="mt-4 text-sm font-medium text-green-700">{{ actionDone }}</p>

                </div>

            </section>

            <!-- Customer + shipping (snapshot taken when the order was placed) -->
            <section class="mt-5 grid gap-5 rounded-xl bg-white p-5 text-sm shadow-sm sm:grid-cols-2 sm:p-6">
                <div>
                    <h2 class="font-semibold text-slate-900">Customer</h2>
                    <p v-if="customerName" class="mt-2 text-slate-700">{{ customerName }}</p>
                    <p v-if="order.email" class="wrap-anywhere text-slate-700">{{ order.email }}</p>
                    <p v-if="order.shippingAddress?.phone" class="text-slate-700">{{ order.shippingAddress.phone }}</p>
                </div>
                <div>
                    <h2 class="font-semibold text-slate-900">Ship to</h2>
                    <p v-for="line in addressLines" :key="line" class="mt-0.5 wrap-anywhere text-slate-700 first:mt-2">{{ line }}</p>
                </div>
            </section>

            <!-- Items + totals: stored values, never recalculated -->
            <section class="mt-5 rounded-xl bg-white p-5 shadow-sm sm:p-6">
                <h2 class="font-semibold text-slate-900">Items</h2>

                <p v-if="!lines.length" class="mt-2 text-sm text-slate-500">This order has no items.</p>

                <table v-else class="mt-3 w-full table-fixed text-left text-sm">
                    <thead class="border-b border-slate-200 text-slate-500">
                        <tr>
                            <th scope="col" class="py-2 pr-3 font-medium">Item</th>
                            <th scope="col" class="hidden w-16 px-3 py-2 text-right font-medium sm:table-cell">Qty</th>
                            <th scope="col" class="hidden w-28 px-3 py-2 text-right font-medium sm:table-cell">Unit price</th>
                            <th scope="col" class="w-24 py-2 pl-3 text-right font-medium sm:w-28">Line total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="line in lines" :key="line.id" class="border-b border-slate-100 align-top">
                            <td class="py-3 pr-3">
                                <p class="wrap-anywhere font-semibold text-slate-900">{{ line.name }}</p>
                                <p v-if="line.options" class="text-slate-500">{{ line.options }}</p>
                                <p v-if="line.sku" class="wrap-anywhere text-xs text-slate-400">SKU {{ line.sku }}</p>
                                <p class="mt-1 text-slate-700 sm:hidden">{{ line.quantity }} × {{ line.unitPrice }}</p>
                            </td>
                            <td class="hidden px-3 py-3 text-right text-slate-900 sm:table-cell">{{ line.quantity }}</td>
                            <td class="hidden px-3 py-3 text-right text-slate-900 sm:table-cell">{{ line.unitPrice }}</td>
                            <td class="py-3 pl-3 text-right font-medium text-slate-900">{{ line.lineTotal }}</td>
                        </tr>
                    </tbody>
                </table>

                <dl class="ml-auto mt-4 grid max-w-xs gap-2 text-sm">
                    <div v-for="row in totals" :key="row.label" class="flex justify-between">
                        <dt class="text-slate-600">{{ row.label }}</dt>
                        <dd class="font-medium text-slate-900">{{ row.value }}</dd>
                    </div>
                    <div class="flex justify-between border-t border-slate-200 pt-2 text-base">
                        <dt class="font-bold text-slate-900">Total<span v-if="order.currency"> ({{ order.currency }})</span></dt>
                        <dd class="font-bold text-slate-900">{{ formatPrice(order.total) }}</dd>
                    </div>
                </dl>
            </section>

        </template>

    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import OrderStatusBadge from "@/components/orders/orderStatusBadge.vue";

import { adminOrderService } from "@/services/adminOrderService";
import { parseApiError } from "@/services/apiClient";
import { formatDate, formatPrice, paymentStatusLabel, statusLabel } from "@/composables/useOrderSuccess";
import { receiptAddressLines, receiptLines, receiptTotals } from "@/utils/receipt";
import { focusHeadingAfterLoad, focusMainContent, setPageTitle } from "@/router/pageFocus";

const route = useRoute();

const order = ref(null);
const loading = ref(true);
const error = ref("");
const notFound = ref(false);

const confirming = ref(false);
const saving = ref(false);
const actionError = ref("");
const actionDone = ref("");

const lines = computed(() => receiptLines(order.value));
const totals = computed(() => receiptTotals(order.value));
const addressLines = computed(() => receiptAddressLines(order.value?.shippingAddress));
const customerName = computed(() => {
    const address = order.value?.shippingAddress;
    return [address?.firstName, address?.lastName].filter(Boolean).join(" ");
});

// Latest navigation wins; a stale response never overwrites the current order.
let requestId = 0;

async function load(id) {
    const current = ++requestId;

    loading.value = true;
    error.value = "";
    notFound.value = false;
    order.value = null;
    confirming.value = false;
    actionError.value = "";
    actionDone.value = "";

    try {
        const data = await adminOrderService.getOrder(id);
        if (current === requestId) {
            order.value = data;
            setPageTitle(`Order #${data.orderNumber} · Admin`);
            focusHeadingAfterLoad();
        }
    } catch (err) {
        if (current !== requestId) return;
        const { status, message } = parseApiError(err);
        notFound.value = status === 404;
        error.value = notFound.value ? "We couldn't find this order." : message;
        focusHeadingAfterLoad();
    } finally {
        if (current === requestId) loading.value = false;
    }
}

async function focusAfterUpdate(id) {
    await nextTick();
    if (document.getElementById(id)) document.getElementById(id).focus();
    else focusMainContent();
}

function openConfirm() {
    confirming.value = true;
    actionError.value = "";
    actionDone.value = "";
    focusAfterUpdate("keep-status");
}

function closeConfirm() {
    confirming.value = false;
    focusAfterUpdate("advance-order");
}

// `saving` is set before the request, so a double click sends one request.
// Like load(), a response that arrives after navigation is ignored.
async function advance() {
    if (saving.value) return;

    const current = requestId;
    const { id, nextStatus: target } = order.value;
    saving.value = true;
    actionError.value = "";

    try {
        const updated = await adminOrderService.advanceStatus(id, target);
        if (current !== requestId) return;
        order.value = updated;
        actionDone.value = `Order marked as ${statusLabel(target).toLowerCase()}.`;
    } catch (err) {
        if (current !== requestId) return;
        actionError.value = parseApiError(err).message;

        // Changed elsewhere (another admin, or the customer cancelled): show the real state.
        if (err.response?.status === 409) {
            const latest = await adminOrderService.getOrder(id).catch(() => null);
            if (latest && current === requestId) order.value = latest;
        }
    } finally {
        saving.value = false;
        if (current === requestId) {
            confirming.value = false;
            focusAfterUpdate("advance-order");
        }
    }
}

watch(() => route.params.id, (id) => id && load(id), { immediate: true });

onBeforeUnmount(() => { requestId++; });
</script>
