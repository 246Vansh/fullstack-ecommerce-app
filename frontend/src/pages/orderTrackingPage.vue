<template>

    <Header />

    <main id="main-content" tabindex="-1" class="bg-surface">

        <div class="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 lg:px-8">

            <RouterLink :to="{ name: 'order-details', params: { id: route.params.id } }"
                class="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-control px-1 text-sm font-medium text-slate-600 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
                Back to order details
            </RouterLink>

            <!-- Loading -->
            <section v-if="loading && !order"
                class="mt-4 flex min-h-96 items-center justify-center rounded-panel border border-slate-200 bg-white">
                <LoadingSpinner class="text-brand" label="Loading tracking details" />
            </section>

            <!-- Error / not found (another user's order looks the same) -->
            <section v-else-if="!order"
                class="mt-4 flex min-h-96 flex-col items-center justify-center rounded-panel border border-slate-200 bg-white px-6 text-center">
                <ExclamationTriangleIcon class="h-8 w-8 text-slate-400" aria-hidden="true" />
                <h1 class="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Tracking unavailable</h1>
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

                <!-- Header -->
                <header class="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                            <h1 class="wrap-anywhere text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                                Track order #{{ order.orderNumber }}
                            </h1>
                            <OrderStatusBadge :status="order.status" />
                        </div>
                        <p class="mt-2 text-sm text-slate-600">
                            Placed {{ formatDate(order.placedAt ?? order.createdAt, true) }}
                            · {{ itemCount }} {{ itemCount === 1 ? "item" : "items" }}
                        </p>
                    </div>

                    <!-- Re-reads the order; it never changes it. -->
                    <PrimaryButton tag="button" variant="outline" size="sm" class="self-start sm:self-auto"
                        :loading="loading" :disabled="loading" @click="load(order.id, { keep: true })">
                        <ArrowPathIcon v-if="!loading" class="h-4 w-4" aria-hidden="true" />
                        {{ loading ? "Refreshing…" : "Refresh" }}
                    </PrimaryButton>

                </header>

                <p v-if="refreshError" role="alert"
                    class="mt-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {{ refreshError }}
                </p>

                <!-- Payment and refund notices, from the server's order state. -->
                <p v-if="order.awaitingPayment" class="mt-4 rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    This order is waiting for online payment.
                    <RouterLink :to="{ name: 'order-details', params: { id: order.id } }"
                        class="font-semibold underline underline-offset-2 hover:text-amber-900">
                        Go to order details to pay
                    </RouterLink>
                </p>
                <p v-if="order.refundDue" role="status"
                    class="mt-3 rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    We received a payment for this order that we couldn't use, so it will be refunded to you.
                    If you have questions, contact support with order #{{ order.orderNumber }}.
                </p>

                <div class="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">

                    <!-- Timeline + items -->
                    <div class="min-w-0 space-y-5">
                        <OrderTrackingTimeline :order="order" />
                        <OrderItemsCard :items="order.items" :currency="order.currency" />
                    </div>

                    <!-- Shipment, address, summary -->
                    <div class="min-w-0 space-y-5">

                        <section class="rounded-panel border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="shipment-heading">
                            <h2 id="shipment-heading" class="flex items-center gap-2 text-base font-semibold text-slate-900">
                                <TruckIcon class="h-5 w-5 text-slate-500" aria-hidden="true" />
                                Shipment
                            </h2>

                            <dl v-if="order.shippedAt || order.deliveredAt" class="mt-4 space-y-2 text-sm">
                                <div v-if="order.shippedAt" class="flex justify-between gap-4">
                                    <dt class="text-slate-600">Shipped</dt>
                                    <dd class="text-right font-medium text-slate-900">{{ formatDate(order.shippedAt, true) }}</dd>
                                </div>
                                <div v-if="order.deliveredAt" class="flex justify-between gap-4">
                                    <dt class="text-slate-600">Delivered</dt>
                                    <dd class="text-right font-medium text-slate-900">{{ formatDate(order.deliveredAt, true) }}</dd>
                                </div>
                            </dl>

                            <p class="mt-3 text-sm text-slate-600">{{ shipmentNote }}</p>
                        </section>

                        <OrderAddressCard :address="order.shippingAddress" :email="order.email ?? ''" />

                        <OrderSummaryCard :order="order" />

                    </div>

                </div>

            </template>

        </div>

    </main>

    <Footer />

</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { ArrowLeftIcon, ArrowPathIcon, ExclamationTriangleIcon, TruckIcon } from "@heroicons/vue/24/outline";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import OrderStatusBadge from "@/components/orders/orderStatusBadge.vue";
import OrderTrackingTimeline from "@/components/orders/orderTrackingTimeline.vue";
import OrderItemsCard from "@/components/orders/orderItemsCard.vue";
import OrderSummaryCard from "@/components/orders/orderSummaryCard.vue";
import OrderAddressCard from "@/components/orders/orderAddressCard.vue";

import { orderService } from "@/services/orderService";
import { parseApiError } from "@/services/apiClient";
import { formatDate } from "@/composables/useOrderSuccess";
import { focusHeadingAfterLoad, setPageTitle } from "@/router/pageFocus";

const route = useRoute();

const order = ref(null);
const loading = ref(true);
const error = ref("");
const notFound = ref(false);
// A failed Refresh keeps the order already shown and reports the error above it.
const refreshError = ref("");

const itemCount = computed(() => order.value?.items.reduce((total, item) => total + item.quantity, 0) ?? 0);

// There is no courier integration: no carrier or tracking number is ever shown.
const shipmentNote = computed(() => {
    switch (order.value?.status) {
        case "CANCELLED":
        case "REFUNDED":
            return "This order will not be shipped.";
        case "DELIVERED":
            return "This order has been delivered.";
        case "SHIPPED":
            return "Courier tracking details aren't available for this order.";
        default:
            return "Shipping details will appear here once your order ships.";
    }
});

// Latest request wins; a stale response never overwrites the current order.
let requestId = 0;

async function load(id, { keep = false } = {}) {
    const current = ++requestId;

    loading.value = true;
    refreshError.value = "";
    if (!keep) {
        error.value = "";
        notFound.value = false;
        order.value = null;
    }

    try {
        const data = await orderService.getOrderTracking(id);
        if (current === requestId) {
            order.value = data;
            setPageTitle(`Track Order #${data.orderNumber}`);
            if (!keep) focusHeadingAfterLoad();
        }
    } catch (err) {
        if (current !== requestId) return;
        const { status, message } = parseApiError(err);

        if (keep && order.value) {
            refreshError.value = message;
            return;
        }
        notFound.value = status === 404;
        error.value = notFound.value ? "We couldn't find this order." : message;
        focusHeadingAfterLoad();
    } finally {
        if (current === requestId) loading.value = false;
    }
}

watch(() => route.params.id, (id) => id && load(id), { immediate: true });

onBeforeUnmount(() => { requestId++; });
</script>
