<template>
    <div class="mx-auto max-w-6xl">

        <!-- Loading -->
        <template v-if="loading && !order">
            <AdminPageHeader :back="BACK" />
            <AdminStatePanel kind="loading" class="mt-4" title="Loading order" />
        </template>

        <!-- Error / not found: the panel's heading is the page's h1 -->
        <template v-else-if="!order">
            <AdminPageHeader :back="BACK" />
            <AdminStatePanel :kind="notFound ? 'empty' : 'error'" :heading-level="1" class="mt-4" title="Order unavailable" :message="error">
                <PrimaryButton v-if="!notFound" tag="button" variant="outline" @click="load(route.params.id)">Try again</PrimaryButton>
                <PrimaryButton v-else :to="{ name: 'admin-orders' }" variant="outline">Back to orders</PrimaryButton>
            </AdminStatePanel>
        </template>

        <template v-else>

            <AdminPageHeader :back="BACK">
                <template #title>Order #{{ order.orderNumber }}</template>
                <template #meta>
                    <AdminOrderStatus :status="order.status" />
                    <span>Placed {{ formatDate(order.placedAt ?? order.createdAt, true) }}</span>
                </template>
            </AdminPageHeader>

            <!-- Fulfilment: progress + the next step (the server enforces the order of steps) -->
            <section aria-labelledby="fulfilment-heading" :class="[CARD, 'mt-6']">
                <h2 id="fulfilment-heading" class="text-lg font-semibold tracking-tight text-slate-900">Fulfilment</h2>

                <!-- The normal path only; cancelled/refunded orders left it. -->
                <ol v-if="stepIndex !== -1" class="mt-5 grid grid-cols-5 gap-1 sm:gap-2" aria-label="Fulfilment progress">
                    <li v-for="(step, index) in FLOW" :key="step" class="min-w-0"
                        :aria-current="index === stepIndex ? 'step' : undefined">
                        <span class="block h-1.5 rounded-full" :class="index <= stepIndex ? 'bg-brand' : 'bg-slate-200'" aria-hidden="true"></span>
                        <span class="mt-2 block truncate text-xs sm:text-sm"
                            :class="index === stepIndex ? 'font-semibold text-slate-900' : index < stepIndex ? 'text-slate-700' : 'text-slate-500'">
                            {{ statusLabel(step) }}
                        </span>
                        <span class="sr-only">{{ index < stepIndex ? "(done)" : index === stepIndex ? "(current)" : "(to do)" }}</span>
                    </li>
                </ol>

                <dl class="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                    <div v-if="order.shippedAt">
                        <dt class="text-slate-500">Shipped</dt>
                        <dd class="mt-1 font-medium text-slate-900">{{ formatDate(order.shippedAt, true) }}</dd>
                    </div>
                    <div v-if="order.deliveredAt">
                        <dt class="text-slate-500">Delivered</dt>
                        <dd class="mt-1 font-medium text-slate-900">{{ formatDate(order.deliveredAt, true) }}</dd>
                    </div>
                </dl>

                <div class="mt-5 border-t border-slate-100 pt-5">

                    <p v-if="!order.nextStatus" class="flex items-start gap-2 text-sm text-slate-600">
                        <InformationCircleIcon class="mt-px h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                        {{ order.awaitingPayment && order.status === "PENDING"
                            ? "Awaiting online payment. The order can be confirmed once the payment is verified."
                            : order.status === "DELIVERED" ? "This order has been delivered." : "This order no longer changes status." }}
                    </p>

                    <template v-else>
                        <div v-if="!confirming" class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p class="text-sm text-slate-600">
                                Next step: <span class="font-semibold text-slate-900">{{ statusLabel(order.nextStatus) }}</span>
                            </p>
                            <PrimaryButton id="advance-order" tag="button" @click="openConfirm">
                                Mark as {{ statusLabel(order.nextStatus).toLowerCase() }}
                            </PrimaryButton>
                        </div>

                        <div v-else role="alertdialog" aria-labelledby="advance-heading" aria-describedby="advance-note"
                            class="rounded-control border border-brand/25 bg-brand-soft/60 p-4">
                            <p id="advance-heading" class="font-semibold text-slate-900">
                                Mark this order as {{ statusLabel(order.nextStatus).toLowerCase() }}?
                            </p>
                            <p id="advance-note" class="mt-1 text-sm text-slate-700">
                                The customer will see the new status. This step cannot be undone.
                            </p>
                            <div class="mt-4 flex flex-wrap gap-3">
                                <PrimaryButton tag="button" :loading="saving" @click="advance">
                                    {{ saving ? "Saving..." : `Yes, mark as ${statusLabel(order.nextStatus).toLowerCase()}` }}
                                </PrimaryButton>
                                <PrimaryButton id="keep-status" tag="button" variant="outline" :disabled="saving" @click="closeConfirm">
                                    Not now
                                </PrimaryButton>
                            </div>
                        </div>
                    </template>

                    <p v-if="actionError" role="alert"
                        class="mt-4 flex items-start gap-2 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                        <ExclamationTriangleIcon class="mt-px h-5 w-5 shrink-0" aria-hidden="true" />
                        {{ actionError }}
                    </p>
                    <p v-else-if="actionDone" role="status"
                        class="mt-4 flex items-start gap-2 rounded-control border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
                        <CheckCircleIcon class="mt-px h-5 w-5 shrink-0" aria-hidden="true" />
                        {{ actionDone }}
                    </p>

                </div>
            </section>

            <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">

                <!-- Items + totals: stored values, never recalculated -->
                <section aria-labelledby="items-heading" :class="[CARD, 'self-start']">
                    <h2 id="items-heading" class="text-lg font-semibold tracking-tight text-slate-900">
                        Items <span class="text-sm font-normal text-slate-500">({{ lines.length }})</span>
                    </h2>

                    <p v-if="!lines.length" class="mt-2 text-sm text-slate-600">This order has no items.</p>

                    <table v-else class="mt-4 w-full table-fixed text-left text-sm">
                        <thead class="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            <tr>
                                <th scope="col" class="py-2 pr-3">Item</th>
                                <th scope="col" class="hidden w-14 px-3 py-2 text-right sm:table-cell">Qty</th>
                                <th scope="col" class="hidden w-28 px-3 py-2 text-right sm:table-cell">Unit price</th>
                                <th scope="col" class="w-24 py-2 pl-3 text-right sm:w-28">Line total</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr v-for="line in lines" :key="line.id" class="align-top">
                                <td class="py-3 pr-3">
                                    <p class="wrap-anywhere font-semibold text-slate-900">{{ line.name }}</p>
                                    <p v-if="line.options" class="text-slate-600">{{ line.options }}</p>
                                    <p v-if="line.sku" class="wrap-anywhere font-mono text-xs text-slate-500">SKU {{ line.sku }}</p>
                                    <p class="mt-1 tabular-nums text-slate-700 sm:hidden">{{ line.quantity }} × {{ line.unitPrice }}</p>
                                </td>
                                <td class="hidden px-3 py-3 text-right tabular-nums text-slate-900 sm:table-cell">{{ line.quantity }}</td>
                                <td class="hidden px-3 py-3 text-right tabular-nums text-slate-900 sm:table-cell">{{ line.unitPrice }}</td>
                                <td class="py-3 pl-3 text-right font-medium tabular-nums text-slate-900">{{ line.lineTotal }}</td>
                            </tr>
                        </tbody>
                    </table>

                    <dl class="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-sm sm:ml-auto sm:max-w-xs">
                        <div v-for="row in totals" :key="row.label" class="flex justify-between gap-4">
                            <dt class="text-slate-600">{{ row.label }}</dt>
                            <dd class="font-medium tabular-nums text-slate-900">{{ row.value }}</dd>
                        </div>
                        <div class="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base">
                            <dt class="font-semibold text-slate-900">Total<span v-if="order.currency"> ({{ order.currency }})</span></dt>
                            <dd class="font-semibold tabular-nums text-slate-900">{{ formatPrice(order.total, order.currency) }}</dd>
                        </div>
                    </dl>
                </section>

                <!-- Customer, shipping (snapshot taken when the order was placed) and payment -->
                <div class="space-y-6">
                    <section aria-labelledby="customer-heading" :class="CARD">
                        <h2 id="customer-heading" class="flex items-center gap-2 font-semibold text-slate-900">
                            <UserIcon class="h-5 w-5 text-slate-400" aria-hidden="true" />
                            Customer
                        </h2>
                        <div class="mt-3 space-y-0.5 text-sm text-slate-700">
                            <p v-if="customerName" class="font-medium text-slate-900">{{ customerName }}</p>
                            <p v-if="order.email" class="wrap-anywhere">{{ order.email }}</p>
                            <p v-if="order.shippingAddress?.phone">{{ order.shippingAddress.phone }}</p>
                        </div>
                    </section>

                    <section aria-labelledby="ship-heading" :class="CARD">
                        <h2 id="ship-heading" class="flex items-center gap-2 font-semibold text-slate-900">
                            <TruckIcon class="h-5 w-5 text-slate-400" aria-hidden="true" />
                            Ship to
                        </h2>
                        <address class="mt-3 text-sm not-italic text-slate-700">
                            <p v-for="line in addressLines" :key="line" class="wrap-anywhere">{{ line }}</p>
                        </address>
                    </section>

                    <section aria-labelledby="payment-heading" :class="CARD">
                        <h2 id="payment-heading" class="flex items-center gap-2 font-semibold text-slate-900">
                            <CreditCardIcon class="h-5 w-5 text-slate-400" aria-hidden="true" />
                            Payment
                        </h2>
                        <dl class="mt-3 space-y-3 text-sm">
                            <div>
                                <dt class="text-slate-500">Status</dt>
                                <dd class="mt-0.5 font-medium text-slate-900">{{ paymentStatusLabel(order.paymentStatus) }}</dd>
                            </div>
                            <div v-if="order.paymentMethod">
                                <dt class="text-slate-500">Method</dt>
                                <dd class="mt-0.5 font-medium text-slate-900">{{ paymentMethodLabel(order.paymentMethod) }}</dd>
                            </div>
                            <div v-if="order.razorpayPaymentId">
                                <dt class="text-slate-500">Razorpay payment</dt>
                                <dd class="mt-0.5 wrap-anywhere font-mono text-xs text-slate-900">{{ order.razorpayPaymentId }}</dd>
                            </div>
                        </dl>
                    </section>
                </div>

            </div>

        </template>

    </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from "@heroicons/vue/20/solid";
import { CreditCardIcon, TruckIcon, UserIcon } from "@heroicons/vue/24/outline";

import AdminOrderStatus from "@/components/admin/ui/adminOrderStatus.vue";
import AdminPageHeader from "@/components/admin/ui/adminPageHeader.vue";
import AdminStatePanel from "@/components/admin/ui/adminStatePanel.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";

import { adminOrderService } from "@/services/adminOrderService";
import { parseApiError } from "@/services/apiClient";
import { formatDate, formatPrice, paymentMethodLabel, paymentStatusLabel, statusLabel } from "@/composables/useOrderSuccess";
import { receiptAddressLines, receiptLines, receiptTotals } from "@/utils/receipt";
import { focusHeadingAfterLoad, focusMainContent, setPageTitle } from "@/router/pageFocus";

const BACK = { label: "All orders", to: { name: "admin-orders" } };
const CARD = "rounded-card border border-slate-200 bg-white p-4 shadow-card sm:p-6";

// The fulfilment path the server walks one step at a time (display only).
const FLOW = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

const route = useRoute();

const order = ref(null);
const loading = ref(true);
const error = ref("");
const notFound = ref(false);

const confirming = ref(false);
const saving = ref(false);
const actionError = ref("");
const actionDone = ref("");

const stepIndex = computed(() => FLOW.indexOf(order.value?.status));
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
