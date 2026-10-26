<template>

    <Header />

    <main id="main-content" tabindex="-1" class="bg-surface">

        <div class="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:px-8">

            <RouterLink :to="{ name: 'orders' }"
                class="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-control px-1 text-sm font-medium text-slate-600 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
                Back to My Orders
            </RouterLink>

            <!-- Loading -->
            <section v-if="loading && !order"
                class="mt-4 flex min-h-96 items-center justify-center rounded-panel border border-slate-200 bg-white">
                <LoadingSpinner class="text-brand" label="Loading order" />
            </section>

            <!-- Error / not found (another user's order looks the same) -->
            <section v-else-if="!order"
                class="mt-4 flex min-h-96 flex-col items-center justify-center rounded-panel border border-slate-200 bg-white px-6 text-center">
                <ExclamationTriangleIcon class="h-8 w-8 text-slate-400" aria-hidden="true" />
                <h1 class="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Order unavailable</h1>
                <p class="mt-2 text-slate-600">{{ error }}</p>
                <div class="mt-8 flex flex-wrap justify-center gap-3">
                    <!-- A missing order will not appear on retry; a failed request might. -->
                    <PrimaryButton v-if="!notFound" tag="button" variant="outline" @click="load(route.params.id)">
                        Try again
                    </PrimaryButton>
                    <PrimaryButton :to="{ name: 'orders' }">
                        View My Orders
                    </PrimaryButton>
                </div>
            </section>

            <template v-else>

                <!-- Order header -->
                <header class="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <h1 class="wrap-anywhere text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                                Order #{{ order.orderNumber }}
                            </h1>
                            <OrderStatusBadge :status="order.status" />
                        </div>
                        <p class="mt-2 text-sm text-slate-600">
                            Placed {{ formatDate(order.createdAt, true) }}
                            <template v-if="order.status === 'CANCELLED'">
                                · Cancelled {{ formatDate(order.updatedAt, true) }}
                            </template>
                            · {{ itemCount }} {{ itemCount === 1 ? "item" : "items" }}
                        </p>
                    </div>

                    <PrimaryButton :to="{ name: 'order-receipt', params: { id: order.id } }" variant="outline" size="sm"
                        class="self-start sm:self-auto">
                        <DocumentTextIcon class="h-4 w-4" aria-hidden="true" />
                        View receipt
                    </PrimaryButton>

                </header>

                <!-- Reservation and refund notices, from the server's order state. -->
                <p v-if="order.expired" class="mt-4 rounded-control border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                    This order was cancelled because its payment wasn't completed within 30 minutes, and its items were released.
                </p>
                <p v-if="order.refundDue" role="status"
                    class="mt-3 rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    We received a payment for this order that we couldn't use, so it will be refunded to you.
                    If you have questions, contact support with order #{{ order.orderNumber }}.
                </p>

                <!-- Online payment: pay, or have the server re-check with Razorpay. -->
                <section v-if="order.paymentMethod === 'RAZORPAY' && (order.payable || paymentMessage)"
                    class="mt-6 rounded-panel border p-5 sm:p-6"
                    :class="paymentState === 'PAID' ? 'border-brand/20 bg-brand-soft' : 'border-slate-200 bg-white'"
                    aria-labelledby="payment-heading">

                    <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                        <div class="flex min-w-0 gap-3">
                            <CheckCircleIcon v-if="paymentState === 'PAID'" class="h-6 w-6 shrink-0 text-brand" aria-hidden="true" />
                            <CreditCardIcon v-else class="h-6 w-6 shrink-0 text-slate-500" aria-hidden="true" />
                            <div class="min-w-0">
                                <h2 id="payment-heading" class="text-base font-semibold text-slate-900">
                                    {{ order.payable ? "Payment required" : "Payment" }}
                                </h2>
                                <p v-if="order.payable && !paymentMessage" class="mt-1 text-sm text-slate-600">
                                    Complete payment to confirm this order.
                                </p>
                                <p v-if="order.payable && order.paymentDueBy" class="mt-1 text-sm text-slate-600">
                                    Pay by {{ formatDate(order.paymentDueBy, true) }} to keep these items reserved for you.
                                </p>
                                <p v-if="paymentMessage" :role="paymentState === 'PAID' ? 'status' : 'alert'"
                                    class="mt-1 text-sm font-medium"
                                    :class="paymentState === 'PAID' ? 'text-brand' : paymentState === 'ERROR' ? 'text-red-700' : 'text-slate-700'">
                                    {{ paymentMessage }}
                                </p>
                            </div>
                        </div>

                        <!-- One request at a time: both buttons are disabled while either runs. -->
                        <div v-if="order.payable" class="flex flex-col gap-3 sm:flex-row lg:shrink-0">
                            <PrimaryButton tag="button" :loading="paying && paymentAction === 'pay'" :disabled="paying"
                                @click="payNow">
                                {{ paying && paymentAction === "pay" ? "Please wait…" : `Pay ${formatPrice(order.total, order.currency)}` }}
                            </PrimaryButton>
                            <PrimaryButton tag="button" variant="outline" :loading="paying && paymentAction === 'refresh'"
                                :disabled="paying" @click="refreshStatus">
                                <ArrowPathIcon v-if="!(paying && paymentAction === 'refresh')" class="h-4 w-4" aria-hidden="true" />
                                {{ paying && paymentAction === "refresh" ? "Checking…" : "Refresh payment status" }}
                            </PrimaryButton>
                        </div>

                    </div>
                </section>

                <div class="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">

                    <!-- Progress + items -->
                    <div class="min-w-0 space-y-5">
                        <OrderProgress :order="order" />
                        <OrderItemsCard :items="order.items" :currency="order.currency" />
                    </div>

                    <!-- Summary, address, cancellation -->
                    <div class="min-w-0 space-y-5">

                        <OrderSummaryCard :order="order" />

                        <OrderAddressCard :address="order.shippingAddress" :email="order.email ?? ''" />

                        <!-- Cancellation: kept apart from payment as the one destructive action. -->
                        <section v-if="order.cancellable || cancelError"
                            class="rounded-panel border border-slate-200 bg-white p-5 sm:p-6" aria-label="Cancel order">

                            <template v-if="order.cancellable">
                                <div v-if="!confirming">
                                    <p class="text-sm text-slate-600">This order can still be cancelled.</p>
                                    <PrimaryButton id="cancel-order" tag="button" variant="danger-outline" class="mt-3"
                                        full-width :disabled="paying" @click="openConfirm">
                                        Cancel Order
                                    </PrimaryButton>
                                </div>

                                <div v-else role="alertdialog" aria-labelledby="cancel-heading" aria-describedby="cancel-note"
                                    class="rounded-card border border-red-200 bg-red-50 p-4">
                                    <p id="cancel-heading" class="font-semibold text-slate-900">Cancel this order?</p>
                                    <p id="cancel-note" class="mt-1 text-sm text-slate-600">
                                        The items will be released back to stock. This cannot be undone.
                                    </p>
                                    <div class="mt-4 flex flex-col gap-3 sm:flex-row lg:flex-col">
                                        <PrimaryButton tag="button" variant="danger" :loading="cancelling" @click="cancel">
                                            {{ cancelling ? "Cancelling..." : "Yes, cancel order" }}
                                        </PrimaryButton>
                                        <PrimaryButton id="keep-order" tag="button" variant="outline" :disabled="cancelling"
                                            @click="closeConfirm">
                                            Keep order
                                        </PrimaryButton>
                                    </div>
                                </div>
                            </template>

                            <p v-if="cancelError" role="alert" class="text-sm font-medium text-red-700"
                                :class="{ 'mt-4': order.cancellable }">
                                {{ cancelError }}
                            </p>

                        </section>

                    </div>

                </div>

            </template>

        </div>

    </main>

    <Footer />

</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    CreditCardIcon,
    DocumentTextIcon,
    ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import OrderStatusBadge from "@/components/orders/orderStatusBadge.vue";
import OrderProgress from "@/components/orders/orderProgress.vue";
import OrderItemsCard from "@/components/orders/orderItemsCard.vue";
import OrderSummaryCard from "@/components/orders/orderSummaryCard.vue";
import OrderAddressCard from "@/components/orders/orderAddressCard.vue";

import { orderService } from "@/services/orderService";
import { parseApiError } from "@/services/apiClient";
import { formatDate, formatPrice } from "@/composables/useOrderSuccess";
import { PAYMENT_MESSAGES, useRazorpayPayment } from "@/composables/useRazorpayPayment";
import { focusHeadingAfterLoad, focusMainContent, setPageTitle } from "@/router/pageFocus";

const route = useRoute();

const order = ref(null);
const loading = ref(true);
const error = ref("");
const notFound = ref(false);

const confirming = ref(false);
const cancelling = ref(false);
const cancelError = ref("");

// Online payment. The result of a checkout attempt arrives as ?payment=STATE;
// only the server's answer (verify or refresh) ever shows this order as paid.
const { busy: paying, pay, refresh } = useRazorpayPayment();
const paymentState = ref("");
const paymentMessage = ref("");
// Which button started the in-flight request, so only that one shows a spinner.
const paymentAction = ref("");

function applyPayment(id, result) {
    // Ignore a result for an order the page no longer shows.
    if (!result || order.value?.id !== id) return;
    paymentState.value = result.state;
    paymentMessage.value = result.message;
    if (result.order) order.value = result.order;
}

async function payNow() {
    if (paying.value) return;
    const id = order.value.id;
    paymentAction.value = "pay";
    applyPayment(id, await pay(id));
}

async function refreshStatus() {
    if (paying.value) return;
    const id = order.value.id;
    paymentAction.value = "refresh";
    applyPayment(id, await refresh(id));
}

const itemCount = computed(() => order.value?.items.reduce((total, item) => total + item.quantity, 0) ?? 0);

// Latest navigation wins; a stale response never overwrites the current order.
let requestId = 0;

async function load(id) {
    const current = ++requestId;

    loading.value = true;
    error.value = "";
    notFound.value = false;
    order.value = null;
    confirming.value = false;
    cancelError.value = "";
    paymentState.value = "";
    paymentMessage.value = "";

    try {
        const data = await orderService.getOrder(id);
        if (current === requestId) {
            order.value = data;

            // Outcome passed from checkout; shown only while it still applies.
            const state = route.query.payment;
            if (data.paymentMethod === "RAZORPAY" && PAYMENT_MESSAGES[state] && (data.payable || data.paymentStatus === "PAID")) {
                paymentState.value = data.paymentStatus === "PAID" ? "PAID" : state;
                paymentMessage.value = PAYMENT_MESSAGES[paymentState.value];
            }
            setPageTitle(`Order #${data.orderNumber}`);
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

// The confirmation is inline, not modal: focus starts on the safe choice
// (Keep order) and returns to "Cancel Order", or to the heading once the
// order is cancelled and that button is gone.
async function focusAfterUpdate(id) {
    await nextTick();
    if (document.getElementById(id)) document.getElementById(id).focus();
    else focusMainContent();
}

function openConfirm() {
    confirming.value = true;
    cancelError.value = "";
    focusAfterUpdate("keep-order");
}

function closeConfirm() {
    confirming.value = false;
    focusAfterUpdate("cancel-order");
}

// `cancelling` is set before the request, so a double click sends one request.
async function cancel() {
    if (cancelling.value) return;

    cancelling.value = true;
    cancelError.value = "";

    try {
        order.value = await orderService.cancelOrder(order.value.id);
        confirming.value = false;
        paymentMessage.value = "";
    } catch (err) {
        cancelError.value = parseApiError(err).message;
        confirming.value = false;

        // Already cancelled elsewhere (another tab) or no longer cancellable: show the real state.
        if (err.response?.status === 409) {
            const latest = await orderService.getOrder(order.value.id).catch(() => null);
            if (latest) order.value = latest;
        }
    } finally {
        cancelling.value = false;
        focusAfterUpdate("cancel-order");
    }
}

watch(() => route.params.id, (id) => id && load(id), { immediate: true });

onBeforeUnmount(() => { requestId++; });
</script>
