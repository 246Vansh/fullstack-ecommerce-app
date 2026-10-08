<template>

    <Header />

    <main id="main-content" tabindex="-1" class="bg-slate-50">

        <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6">

            <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">
                My Orders
            </h1>

            <!-- Loading -->
            <section v-if="loading"
                class="mt-6 flex min-h-60 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
                <LoadingSpinner class="text-gray-400" label="Loading your orders" />
            </section>

            <!-- Error -->
            <section v-else-if="error"
                class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-4 text-center">
                <h2 class="text-xl font-bold text-gray-900">Orders unavailable</h2>
                <p class="mt-2 text-gray-500">{{ error }}</p>
                <button type="button"
                    class="mt-6 rounded-xl border border-gray-200 px-6 py-3 font-semibold text-slate-700 hover:bg-gray-50 cursor-pointer"
                    @click="load">
                    Try again
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

            <!-- List -->
            <ul v-else class="mt-6 space-y-4">
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

        </div>

    </main>

    <Footer />

</template>

<script setup>
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { ChevronRightIcon } from "@heroicons/vue/24/outline";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import OrderStatusBadge from "@/components/orders/orderStatusBadge.vue";

import { orderService } from "@/services/orderService";
import { parseApiError } from "@/services/apiClient";
import { formatDate, formatPrice } from "@/composables/useOrderSuccess";

const orders = ref([]);
const loading = ref(true);
const error = ref("");

async function load() {
    loading.value = true;
    error.value = "";

    try {
        orders.value = await orderService.listOrders();
    } catch (err) {
        error.value = parseApiError(err).message;
    } finally {
        loading.value = false;
    }
}

onMounted(load);
</script>
