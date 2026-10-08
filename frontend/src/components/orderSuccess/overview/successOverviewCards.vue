<template>

    <section class="mt-7 grid gap-5 xl:grid-cols-4">

        <!-- Date (there is no delivery estimate yet) -->

        <successOverviewCard :icon="TruckIcon" title="Order Date" :value="formatDate(order.createdAt)"
            subtitle="The date this order was placed" icon-background="bg-green-100" icon-color="text-green-600"
            value-color="text-green-700" />

        <!-- Items -->

        <successOverviewCard :icon="ShoppingBagIcon" title="Total Items" :value="`${totalQuantity} ${totalQuantity === 1 ? 'Item' : 'Items'}`"
            :subtitle="`${productCount} ${productCount === 1 ? 'product' : 'products'} in this order`" icon-background="bg-indigo-100" icon-color="text-indigo-600"
            value-color="text-indigo-600" />

        <!-- Amount -->

        <successOverviewCard :icon="CurrencyDollarIcon" title="Total Amount" :value="formatPrice(order.total)"
            :subtitle="`Payment: ${paymentStatusLabel(order.paymentStatus)}`" icon-background="bg-orange-100" icon-color="text-orange-600"
            value-color="text-orange-600" />

        <!-- Status -->

        <successOverviewCard :icon="ShieldCheckIcon" title="Order Status" :value="statusLabel(order.status)"
            subtitle="We've received your order" icon-background="bg-green-100" icon-color="text-green-600"
            value-color="text-green-600" />

    </section>

</template>

<script setup>
import {
    TruckIcon,
    ShoppingBagIcon,
    CurrencyDollarIcon,
    ShieldCheckIcon,
} from "@heroicons/vue/24/outline";

import successOverviewCard from "./successOverviewCard.vue";
import { formatDate, formatPrice, paymentStatusLabel, statusLabel } from "@/composables/useOrderSuccess";

defineProps({
    order: {
        type: Object,
        required: true,
    },
    productCount: Number,
    totalQuantity: Number,
});
</script>