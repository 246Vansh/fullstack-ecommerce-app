<template>

    <Header />

    <main class="bg-slate-50">

        <div class="mx-auto max-w-[1700px] px-4 py-6 sm:px-6">

            <RouterLink :to="{ name: 'orders' }" class="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                ← My Orders
            </RouterLink>

            <!-- Loading -->
            <section v-if="loading && !order"
                class="mt-4 flex min-h-100 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
                <LoadingSpinner class="text-gray-400" />
            </section>

            <!-- Error / not found (another user's order looks the same) -->
            <section v-else-if="!order"
                class="mt-4 flex min-h-100 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-4 text-center">
                <h1 class="text-2xl font-bold text-gray-900">Order unavailable</h1>
                <p class="mt-2 text-gray-500">{{ error }}</p>
                <RouterLink :to="{ name: 'orders' }"
                    class="mt-6 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">
                    View My Orders
                </RouterLink>
            </section>

            <template v-else>

                <!-- Summary -->
                <section class="mt-4 rounded-xl bg-white p-5 shadow-sm sm:p-6">

                    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                        <div class="min-w-0">
                            <h1 class="wrap-anywhere text-2xl font-extrabold text-slate-900">
                                Order #{{ order.orderNumber }}
                            </h1>
                            <p class="mt-1 text-sm text-slate-500">
                                Placed {{ formatDate(order.createdAt, true) }}
                                <template v-if="order.status === 'CANCELLED'">
                                    · Cancelled {{ formatDate(order.updatedAt, true) }}
                                </template>
                            </p>
                        </div>

                        <OrderStatusBadge :status="order.status" class="self-start" />

                    </div>

                    <!-- Totals: stored on the order when it was placed -->
                    <dl class="mt-5 grid max-w-sm gap-2 text-sm">
                        <div v-for="row in totals" :key="row.label" class="flex justify-between">
                            <dt class="text-slate-600">{{ row.label }}</dt>
                            <dd class="font-medium text-slate-900">{{ row.value }}</dd>
                        </div>
                        <div class="flex justify-between border-t border-gray-100 pt-2">
                            <dt class="font-bold text-slate-900">Total</dt>
                            <dd class="font-bold text-slate-900">{{ formatPrice(order.total) }}</dd>
                        </div>
                        <div class="flex justify-between">
                            <dt class="text-slate-600">Payment</dt>
                            <dd class="font-medium text-slate-900">{{ paymentStatusLabel(order.paymentStatus) }}</dd>
                        </div>
                    </dl>

                    <!-- Cancellation -->
                    <div v-if="order.cancellable" class="mt-6 border-t border-gray-100 pt-5">

                        <button v-if="!confirming" type="button"
                            class="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                            @click="confirming = true; cancelError = ''">
                            Cancel Order
                        </button>

                        <div v-else role="alertdialog" aria-labelledby="cancel-heading"
                            class="rounded-xl border border-red-200 bg-red-50 p-4">
                            <p id="cancel-heading" class="font-semibold text-slate-900">Cancel this order?</p>
                            <p class="mt-1 text-sm text-slate-600">
                                The items will be released back to stock. This cannot be undone.
                            </p>
                            <div class="mt-4 flex flex-wrap gap-3">
                                <button type="button" :disabled="cancelling"
                                    class="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                                    @click="cancel">
                                    {{ cancelling ? "Cancelling..." : "Yes, cancel order" }}
                                </button>
                                <button type="button" :disabled="cancelling"
                                    class="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                                    @click="confirming = false">
                                    Keep order
                                </button>
                            </div>
                        </div>

                    </div>

                    <p v-if="cancelError" role="alert" class="mt-4 text-sm font-medium text-red-600">
                        {{ cancelError }}
                    </p>

                </section>

                <!-- Items + address -->
                <section class="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
                    <purchasedProducts :products="order.items" />
                    <shippingCard :address="order.shippingAddress" class="self-start" />
                </section>

            </template>

        </div>

    </main>

    <Footer />

</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import OrderStatusBadge from "@/components/orders/orderStatusBadge.vue";
import purchasedProducts from "@/components/orderSuccess/details/purchasedProducts.vue";
import shippingCard from "@/components/orderSuccess/details/shippingCard.vue";

import { orderService } from "@/services/orderService";
import { parseApiError } from "@/services/apiClient";
import { formatDate, formatPrice, paymentStatusLabel } from "@/composables/useOrderSuccess";

const route = useRoute();

const order = ref(null);
const loading = ref(true);
const error = ref("");

const confirming = ref(false);
const cancelling = ref(false);
const cancelError = ref("");

const totals = computed(() => [
    { label: "Subtotal", value: formatPrice(order.value.subtotal) },
    { label: "Shipping", value: formatPrice(order.value.shipping) },
    { label: "Tax", value: formatPrice(order.value.tax) },
    ...(Number(order.value.discount) > 0 ? [{ label: "Discount", value: `-${formatPrice(order.value.discount)}` }] : []),
]);

// Latest navigation wins; a stale response never overwrites the current order.
let requestId = 0;

async function load(id) {
    const current = ++requestId;

    loading.value = true;
    error.value = "";
    order.value = null;
    confirming.value = false;
    cancelError.value = "";

    try {
        const data = await orderService.getOrder(id);
        if (current === requestId) order.value = data;
    } catch (err) {
        if (current !== requestId) return;
        const { status, message } = parseApiError(err);
        error.value = status === 404 ? "We couldn't find this order." : message;
    } finally {
        if (current === requestId) loading.value = false;
    }
}

// `cancelling` is set before the request, so a double click sends one request.
async function cancel() {
    if (cancelling.value) return;

    cancelling.value = true;
    cancelError.value = "";

    try {
        order.value = await orderService.cancelOrder(order.value.id);
        confirming.value = false;
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
    }
}

watch(() => route.params.id, (id) => id && load(id), { immediate: true });

onBeforeUnmount(() => { requestId++; });
</script>
