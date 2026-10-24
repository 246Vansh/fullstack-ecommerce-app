<template>
    <section class="rounded-panel border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="cart-summary-heading">

        <h2 id="cart-summary-heading" class="text-lg font-semibold text-slate-900">
            Order summary
        </h2>

        <!-- Amounts in different currencies are never added up into one subtotal. -->
        <summaryRow v-if="!mixedCurrency" class="mt-2" label="Subtotal" :value="formatPrice(subtotal, currency)" :is-total="true" divider />

        <summaryRow v-if="!mixedCurrency && discount > 0" label="Discount" :value="`-${formatPrice(discount, currency)}`"
            value-class="font-semibold text-brand" divider />

        <!-- The cart never states a final total; checkout prices the order on the server. -->
        <p class="flex items-center gap-2 py-4 text-sm text-slate-600">
            <TruckIcon class="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            Shipping &amp; tax calculated at checkout
        </p>

        <!-- Why checkout can't start yet (states the client knows as the server does). -->
        <p v-if="blockedReason" id="cart-checkout-blocked" role="alert"
            class="mb-4 rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {{ blockedReason }}
        </p>

        <checkoutButton :disabled="Boolean(blockedReason)"
            :aria-describedby="blockedReason ? 'cart-checkout-blocked' : undefined" />

        <p class="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <LockClosedIcon class="h-3.5 w-3.5" aria-hidden="true" />
            Secure checkout
        </p>

    </section>
</template>

<script setup>
import { LockClosedIcon, TruckIcon } from "@heroicons/vue/24/outline";
import checkoutButton from "./checkoutButton.vue";
import summaryRow from "./summaryRow.vue";
import { formatPrice } from "@/utils/money";

defineProps({
    subtotal: {
        type: Number,
        default: 0,
    },

    // The cart's one currency; null when empty or mixed.
    currency: {
        type: String,
        default: null,
    },

    mixedCurrency: {
        type: Boolean,
        default: false,
    },

    // A server-provided order discount; the cart API has none today, so it is not shown.
    discount: {
        type: Number,
        default: 0,
    },

    // Why checkout cannot start from this cart ("" when it can).
    blockedReason: {
        type: String,
        default: "",
    },
});

</script>
