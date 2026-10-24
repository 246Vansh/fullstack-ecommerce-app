<template>

    <!-- Order tracking is not implemented yet, so it is not offered. -->
    <nav aria-label="Order actions" class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">

        <!-- This order (where an unpaid online order can also be paid) -->
        <PrimaryButton :to="{ name: 'order-details', params: { id: orderId } }" size="lg">
            <DocumentTextIcon class="h-5 w-5" aria-hidden="true" />
            {{ payable ? "Pay for this order" : "View Order" }}
        </PrimaryButton>

        <!-- Continue Shopping -->
        <PrimaryButton to="/products" variant="outline" size="lg">
            <ShoppingBagIcon class="h-5 w-5" aria-hidden="true" />
            Continue Shopping
        </PrimaryButton>

        <!-- Printable receipt + order history -->
        <div class="flex flex-wrap gap-x-2 sm:ml-auto">
            <RouterLink :to="{ name: 'order-receipt', params: { id: orderId } }" :class="LINK">
                <PrinterIcon class="h-5 w-5" aria-hidden="true" />
                Receipt
            </RouterLink>

            <RouterLink :to="{ name: 'orders' }" :class="LINK">
                <ClipboardDocumentListIcon class="h-5 w-5" aria-hidden="true" />
                My Orders
            </RouterLink>
        </div>

    </nav>

</template>

<script setup>
import { RouterLink } from "vue-router";
import { ClipboardDocumentListIcon, DocumentTextIcon, PrinterIcon, ShoppingBagIcon } from "@heroicons/vue/24/outline";

import PrimaryButton from "@/components/ui/primaryButton.vue";

const LINK = "inline-flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-semibold text-slate-700 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

defineProps({
    orderId: {
        type: Number,
        required: true,
    },

    // An online order that can still be paid (from the server).
    payable: {
        type: Boolean,
        default: false,
    },
});
</script>
