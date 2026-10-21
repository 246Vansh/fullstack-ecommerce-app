<template>

    <div class="print:hidden">
        <Header />
    </div>

    <main id="main-content" tabindex="-1" class="bg-slate-50 print:bg-white">

        <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6 print:max-w-none print:p-0">

            <RouterLink :to="{ name: 'order-details', params: { id: route.params.id } }"
                class="text-sm font-medium text-indigo-600 hover:text-indigo-700 print:hidden">
                <span aria-hidden="true">←</span> Back to order
            </RouterLink>

            <!-- Loading -->
            <section v-if="loading && !order"
                class="mt-4 flex min-h-100 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
                <LoadingSpinner class="text-gray-400" label="Loading receipt" />
            </section>

            <!-- Error / not found (another user's order looks the same) -->
            <section v-else-if="!order"
                class="mt-4 flex min-h-100 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-4 text-center">
                <h1 class="text-2xl font-bold text-gray-900">Receipt unavailable</h1>
                <p class="mt-2 text-gray-500">{{ error }}</p>
                <div class="mt-6 flex flex-wrap justify-center gap-3 print:hidden">
                    <button v-if="!notFound" type="button"
                        class="rounded-xl border border-gray-200 px-6 py-3 font-semibold text-slate-700 hover:bg-gray-50 cursor-pointer"
                        @click="load(route.params.id)">
                        Try again
                    </button>
                    <RouterLink :to="{ name: 'orders' }"
                        class="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700">
                        View My Orders
                    </RouterLink>
                </div>
            </section>

            <article v-else class="mt-4 rounded-xl bg-white p-5 shadow-sm sm:p-8 print:mt-0 print:rounded-none print:p-0 print:shadow-none">

                <!-- Heading -->
                <header class="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-start sm:justify-between">

                    <div class="min-w-0">
                        <p class="text-sm font-semibold uppercase tracking-wider text-slate-500">Order Receipt</p>
                        <h1 class="mt-1 wrap-anywhere text-2xl font-extrabold text-slate-900">
                            Order #{{ order.orderNumber }}
                        </h1>
                        <p class="mt-1 text-sm text-slate-600">
                            Placed {{ formatDate(order.placedAt ?? order.createdAt, true) }}
                        </p>
                    </div>

                    <button type="button"
                        class="self-start rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 cursor-pointer print:hidden"
                        @click="print">
                        Print / Save as PDF
                    </button>

                </header>

                <!-- Status: stored values only; payment is never assumed -->
                <dl class="grid gap-4 border-b border-gray-200 py-5 text-sm sm:grid-cols-3">
                    <div>
                        <dt class="text-slate-500">Order status</dt>
                        <dd class="mt-1"><OrderStatusBadge :status="order.status" /></dd>
                    </div>
                    <div>
                        <dt class="text-slate-500">Payment status</dt>
                        <dd class="mt-1 font-semibold text-slate-900">{{ paymentStatusLabel(order.paymentStatus) }}</dd>
                    </div>
                    <div v-if="order.paymentMethod">
                        <dt class="text-slate-500">Payment method</dt>
                        <dd class="mt-1 font-semibold text-slate-900">{{ paymentMethodLabel(order.paymentMethod) }}</dd>
                    </div>
                    <div v-if="order.status === 'CANCELLED'">
                        <dt class="text-slate-500">Cancelled</dt>
                        <dd class="mt-1 font-semibold text-slate-900">{{ formatDate(order.updatedAt, true) }}</dd>
                    </div>
                </dl>

                <!-- Customer + shipping (snapshot taken when the order was placed) -->
                <section class="grid gap-5 border-b border-gray-200 py-5 text-sm sm:grid-cols-2">
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

                <!-- Items -->
                <section class="py-5">
                    <h2 class="sr-only">Items</h2>
                    <!-- Phones fold Qty and Unit price into the item cell instead of scrolling sideways. -->
                    <table class="w-full table-fixed text-left text-sm">
                        <thead class="border-b border-gray-200 text-slate-500">
                            <tr>
                                <th scope="col" class="py-2 pr-3 font-medium">Item</th>
                                <th scope="col" class="hidden w-16 px-3 py-2 text-right font-medium sm:table-cell">Qty</th>
                                <th scope="col" class="hidden w-28 px-3 py-2 text-right font-medium sm:table-cell">Unit price</th>
                                <th scope="col" class="w-24 py-2 pl-3 text-right font-medium sm:w-28">Line total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="line in lines" :key="line.id" class="border-b border-gray-100 align-top print:break-inside-avoid">
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
                </section>

                <!-- Totals: saved on the order, never recalculated -->
                <dl class="ml-auto grid max-w-xs gap-2 text-sm print:break-inside-avoid">
                    <div v-for="row in totals" :key="row.label" class="flex justify-between">
                        <dt class="text-slate-600">{{ row.label }}</dt>
                        <dd class="font-medium text-slate-900">{{ row.value }}</dd>
                    </div>
                    <div class="flex justify-between border-t border-gray-200 pt-2 text-base">
                        <dt class="font-bold text-slate-900">Total<span v-if="order.currency"> ({{ order.currency }})</span></dt>
                        <dd class="font-bold text-slate-900">{{ formatPrice(order.total, order.currency) }}</dd>
                    </div>
                </dl>

                <p class="mt-8 border-t border-gray-200 pt-4 text-xs text-slate-500">
                    This is an order receipt generated from your saved order record. It is not a tax invoice.
                </p>

            </article>

        </div>

    </main>

    <div class="print:hidden">
        <Footer />
    </div>

</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import OrderStatusBadge from "@/components/orders/orderStatusBadge.vue";

import { orderService } from "@/services/orderService";
import { parseApiError } from "@/services/apiClient";
import { formatDate, formatPrice, paymentMethodLabel, paymentStatusLabel } from "@/composables/useOrderSuccess";
import { receiptAddressLines, receiptLines, receiptTotals } from "@/utils/receipt";
import { focusHeadingAfterLoad, setPageTitle } from "@/router/pageFocus";

const route = useRoute();

const order = ref(null);
const loading = ref(true);
const error = ref("");
const notFound = ref(false);

const lines = computed(() => receiptLines(order.value));
const totals = computed(() => receiptTotals(order.value));
const addressLines = computed(() => receiptAddressLines(order.value?.shippingAddress));
const customerName = computed(() => {
    const address = order.value?.shippingAddress;
    return [address?.firstName, address?.lastName].filter(Boolean).join(" ");
});

// Same endpoint as the order page: the server only returns the signed-in
// user's own orders, so another customer's id is a 404 here too.
let requestId = 0;

async function load(id) {
    const current = ++requestId;

    loading.value = true;
    error.value = "";
    notFound.value = false;
    order.value = null;

    try {
        const data = await orderService.getOrder(id);
        if (current === requestId) {
            order.value = data;
            setPageTitle(`Receipt #${data.orderNumber}`);
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

// The browser's print dialog also offers "Save as PDF"; no PDF library needed.
const print = () => window.print();

watch(() => route.params.id, (id) => id && load(id), { immediate: true });

onBeforeUnmount(() => { requestId++; });
</script>

<style>
@media print {
    @page {
        margin: 14mm;
    }
}
</style>
