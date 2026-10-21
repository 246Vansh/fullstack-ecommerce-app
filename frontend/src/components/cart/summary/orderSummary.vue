<template>
    <aside class="rounded-xl border border-gray-200 bg-white p-7 shadow-sm">

        <!-- Header -->
        <div class="flex items-start gap-4">

            <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                <ClipboardDocumentListIcon class="h-6 w-6 text-indigo-600" />
            </div>

            <div>
                <h2 class="text-2xl font-bold text-slate-900">
                    Order Summary
                </h2>

                <p class="text-sm text-gray-500">
                    Review your order before proceeding to checkout.
                </p>
            </div>

        </div>

        <!-- Divider -->
        <div class="my-6 h-px bg-gray-100"></div>

        <!-- Summary -->
        <!-- Amounts in different currencies are never added up into one subtotal. -->
        <p v-if="mixedCurrency" role="alert"
            class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Your cart has items priced in different currencies. Remove the items in one currency to check out.
        </p>

        <summaryRow v-else label="Subtotal" :value="formatPrice(subtotal, currency)" :is-total="true" divider />

        <summaryRow v-if="discount > 0" label="Discount" :value="`-${formatPrice(discount, currency)}`"
            value-class="font-semibold text-emerald-600" divider />

        <!-- The cart never states a final total; checkout prices the order on the server. -->
        <p class="py-4 text-sm text-slate-500">
            Shipping &amp; tax calculated at checkout
        </p>

        <!-- Savings -->
        <div v-if="discount > 0" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p class="text-center text-sm font-medium text-emerald-700">
                🎉 You saved
                <span class="font-bold">
                    {{ formatPrice(discount, currency) }}
                </span>
                on this order.
            </p>
        </div>

        <!-- Checkout Button -->
        <div class="mt-4">
            <checkoutButton />
        </div>

    </aside>
</template>

<script setup>
import { ClipboardDocumentListIcon } from "@heroicons/vue/24/outline";
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

    discount: {
        type: Number,
        default: 0,
    },
});

</script>