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

                    <!-- A refund of this order's payment (partial, or with an anomaly) blocks
                         fulfilment until an admin acknowledges exactly the state shown here. -->
                    <div v-if="order.refundReview?.blocking" role="region" aria-labelledby="refund-review-heading"
                        class="mb-4 rounded-control border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                        <h3 id="refund-review-heading" class="flex items-center gap-1.5 font-semibold">
                            <ExclamationTriangleIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
                            Refund review required before fulfilment
                        </h3>
                        <p v-if="paymentRefunds" class="mt-1">
                            {{ paymentRefunds.state }}: {{ paymentRefunds.refunded }} of {{ paymentRefunds.captured }} refunded,
                            <span class="font-semibold">{{ paymentRefunds.net }} retained</span>. Check the refunds in the Payment
                            section, then confirm that this order should still be fulfilled.
                        </p>
                        <ul v-if="paymentRefunds?.anomalies.length" class="mt-2 list-disc space-y-1 pl-5">
                            <li v-for="message in paymentRefunds.anomalies" :key="message">{{ message }}</li>
                        </ul>
                        <p v-if="order.refundReview.reviewedAt" class="mt-2 text-amber-800">
                            An earlier acknowledgement ({{ formatDate(order.refundReview.reviewedAt, true) }}) no longer
                            applies: refunds have changed since.
                        </p>
                        <PrimaryButton id="acknowledge-refund" tag="button" class="mt-3" :loading="acknowledging" @click="acknowledgeRefund">
                            {{ acknowledging ? "Saving..." : "I have reviewed the refunds; allow fulfilment" }}
                        </PrimaryButton>
                    </div>
                    <p v-else-if="order.refundReview?.acknowledged" class="mb-4 flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircleIcon class="mt-px h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                        Refunds reviewed by {{ order.refundReview.reviewedBy?.name ?? "an admin" }} on
                        {{ formatDate(order.refundReview.reviewedAt, true) }}.
                    </p>

                    <p v-if="!order.nextStatus && !order.refundReview?.blocking" class="flex items-start gap-2 text-sm text-slate-600">
                        <InformationCircleIcon class="mt-px h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                        {{ order.awaitingPayment && order.status === "PENDING"
                            ? "Awaiting online payment. The order can be confirmed once the payment is verified."
                            : order.status === "DELIVERED" ? "This order has been delivered." : "This order no longer changes status." }}
                    </p>

                    <template v-else-if="order.nextStatus">
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
                            <div v-if="order.expiredAt">
                                <dt class="text-slate-500">Reservation expired</dt>
                                <dd class="mt-0.5 font-medium text-slate-900">{{ formatDate(order.expiredAt, true) }} (not paid within 30 minutes)</dd>
                            </div>
                        </dl>

                        <!-- Refunds of the payment that paid this order (Razorpay refund.processed). -->
                        <div v-if="paymentRefunds" class="mt-4 border-t border-slate-200 pt-4">
                            <h3 class="text-sm font-semibold text-slate-900">Refunds</h3>
                            <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                <dt class="text-slate-500">Captured</dt>
                                <dd class="text-right tabular-nums text-slate-900">{{ paymentRefunds.captured }}</dd>
                                <dt class="text-slate-500">Refunded</dt>
                                <dd class="text-right tabular-nums text-slate-900">{{ paymentRefunds.refunded }}</dd>
                                <dt class="font-medium text-slate-700">Net retained</dt>
                                <dd class="text-right font-semibold tabular-nums text-slate-900">{{ paymentRefunds.net }}</dd>
                                <dt class="text-slate-500">State</dt>
                                <dd class="text-right font-medium text-slate-900">{{ paymentRefunds.state }}</dd>
                            </dl>
                            <ul class="mt-3 space-y-2 text-sm">
                                <li v-for="refund in paymentRefundRecords" :key="refund.id">
                                    <p class="font-medium tabular-nums text-slate-900">
                                        {{ refund.amount }}<span v-if="!refund.counted" class="font-semibold text-red-700"> · not counted</span>
                                    </p>
                                    <p class="wrap-anywhere font-mono text-xs text-slate-600">{{ refund.id }}</p>
                                    <p class="text-xs text-slate-500">{{ formatDate(refund.receivedAt, true) }} · {{ refund.email }}</p>
                                    <button v-if="refund.resendable" type="button" :disabled="resending === refund.id"
                                        class="mt-1 text-xs font-semibold text-brand underline disabled:opacity-50" @click="resendRefundEmail(refund.id)">
                                        {{ resending === refund.id ? "Resending..." : "Resend email" }}
                                    </button>
                                </li>
                            </ul>
                        </div>

                        <!-- Captured money the server could not apply to this order. Refund it in the
                             Razorpay dashboard; it is marked refunded only when Razorpay confirms it. -->
                        <div v-if="order.unappliedPayments?.length" class="mt-4 border-t border-slate-200 pt-4">
                            <h3 class="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                                <ExclamationTriangleIcon class="h-4 w-4" aria-hidden="true" />
                                Payments to refund
                            </h3>
                            <ul class="mt-2 space-y-3 text-sm">
                                <li v-for="payment in order.unappliedPayments" :key="payment.razorpayPaymentId">
                                    <p class="font-medium text-slate-900">
                                        {{ formatPrice(payment.amount / 100, payment.currency) }}
                                        · {{ UNAPPLIED_REASONS[payment.reason] ?? payment.reason }}
                                    </p>
                                    <p class="wrap-anywhere font-mono text-xs text-slate-600">{{ payment.razorpayPaymentId }}</p>
                                    <p :class="payment.refundedAt ? 'text-slate-600' : 'font-semibold text-red-700'">
                                        {{ payment.refundedAt
                                            ? `Refunded ${formatDate(payment.refundedAt, true)} (confirmed by Razorpay)`
                                            : payment.refunds?.refundedAmount
                                                ? `Partly refunded: ${formatMinor(payment.refunds.refundedAmount, payment.currency)} of ${formatMinor(payment.amount, payment.currency)}; refund the rest in the Razorpay dashboard`
                                                : "Refund not confirmed yet: refund it in the Razorpay dashboard" }}
                                    </p>
                                    <ul v-if="payment.refunds?.refunds?.length" class="mt-1 space-y-0.5 text-xs text-slate-500">
                                        <li v-for="refund in refundRecordRows(payment.refunds)" :key="refund.id">
                                            {{ refund.amount }} · <span class="font-mono">{{ refund.id }}</span> · {{ refund.email }}
                                        </li>
                                    </ul>
                                </li>
                            </ul>
                        </div>
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
import { acknowledgementFor, formatMinor, refundRecordRows, refundSummaryRows } from "@/utils/refunds";
import { focusHeadingAfterLoad, focusMainContent, setPageTitle } from "@/router/pageFocus";

const BACK = { label: "All orders", to: { name: "admin-orders" } };
const CARD = "rounded-card border border-slate-200 bg-white p-4 shadow-card sm:p-6";

// Why a captured payment could not be applied (backend paymentService reasons).
const UNAPPLIED_REASONS = {
    expired_stock_unavailable: "arrived after the order expired; items no longer in stock",
    order_not_payable: "arrived after the order was cancelled",
    order_already_paid: "second payment for an order already paid",
    duplicate_capture: "duplicate payment",
    amount_or_currency_mismatch: "amount or currency did not match the order",
    refunded_before_applied: "refunded in full by Razorpay before it could be applied",
};

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
const acknowledging = ref(false);
const resending = ref("");

const stepIndex = computed(() => FLOW.indexOf(order.value?.status));
const lines = computed(() => receiptLines(order.value));
const totals = computed(() => receiptTotals(order.value));
const addressLines = computed(() => receiptAddressLines(order.value?.shippingAddress));
const paymentRefunds = computed(() => refundSummaryRows(order.value?.paymentRefunds));
const paymentRefundRecords = computed(() => refundRecordRows(order.value?.paymentRefunds));
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

// Acknowledges exactly the refund state on screen. If a refund arrived since
// the page loaded, the server refuses (409) and the latest state is shown,
// so a stale acknowledgement can never approve refunds the admin has not seen.
async function acknowledgeRefund() {
    if (acknowledging.value) return;

    const current = requestId;
    const { id, paymentRefunds: view } = order.value;
    acknowledging.value = true;
    actionError.value = "";
    actionDone.value = "";

    try {
        const updated = await adminOrderService.acknowledgeRefund(id, acknowledgementFor(view));
        if (current !== requestId) return;
        order.value = updated;
        actionDone.value = "Refunds acknowledged. The order can be fulfilled.";
    } catch (err) {
        if (current !== requestId) return;
        actionError.value = parseApiError(err).message;

        if (err.response?.status === 409) {
            const latest = await adminOrderService.getOrder(id).catch(() => null);
            if (latest && current === requestId) order.value = latest;
        }
    } finally {
        acknowledging.value = false;
        if (current === requestId) focusAfterUpdate(order.value?.nextStatus ? "advance-order" : "acknowledge-refund");
    }
}

// Asks the server to send an exhausted refund email again (one request at a
// time); the order is reloaded either way so the email state shown is current.
async function resendRefundEmail(refundId) {
    if (resending.value) return;

    const current = requestId;
    const { id } = order.value;
    resending.value = refundId;
    actionError.value = "";
    actionDone.value = "";

    try {
        const updated = await adminOrderService.resendRefundEmail(id, refundId);
        if (current !== requestId) return;
        order.value = updated;
        actionDone.value = "The refund email will be sent again.";
    } catch (err) {
        if (current !== requestId) return;
        actionError.value = parseApiError(err).message;
        const latest = await adminOrderService.getOrder(id).catch(() => null);
        if (latest && current === requestId) order.value = latest;
    } finally {
        resending.value = "";
    }
}

watch(() => route.params.id, (id) => id && load(id), { immediate: true });

onBeforeUnmount(() => { requestId++; });
</script>
