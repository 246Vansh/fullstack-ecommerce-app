<template>

    <section class="mt-7 grid gap-5 xl:grid-cols-4">

        <!-- Delivery -->

        <successOverviewCard :icon="TruckIcon" title="Estimated Delivery" value="Tue, 18 Aug 2026"
            subtitle="2–3 Business Days" icon-background="bg-green-100" icon-color="text-green-600"
            value-color="text-green-700" />

        <!-- Items -->

        <successOverviewCard :icon="ShoppingBagIcon" title="Total Items" value="4 Items"
            subtitle="All items in this order" icon-background="bg-indigo-100" icon-color="text-indigo-600"
            value-color="text-indigo-600" />

        <!-- Amount -->

        <successOverviewCard :icon="CurrencyDollarIcon" title="Total Amount" value="$489.98"
            subtitle="Payment Successful" icon-background="bg-orange-100" icon-color="text-orange-600"
            value-color="text-orange-600" />

        <!-- Status -->

        <successOverviewCard :icon="ShieldCheckIcon" title="Order Status" value="Confirmed"
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
</script>