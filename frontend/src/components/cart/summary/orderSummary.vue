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
        <summaryRow label="Subtotal" :value="formatPrice(subtotal)" divider />

        <summaryRow label="Discount" :value="discount > 0 ? `-${formatPrice(discount)}` : '$0.00'"
            value-class="font-semibold text-emerald-600" divider />

        <summaryRow label="Shipping" :value="shipping === 0 ? 'FREE' : formatPrice(shipping)"
            :value-class="shipping === 0 ? 'font-semibold text-emerald-600' : ''" divider />

        <summaryRow label="Estimated Tax" :value="formatPrice(tax)" :show-info="true" divider />

        <summaryRow label="Total" :value="formatPrice(total)" :is-total="true" />

        <!-- Savings -->
        <div v-if="discount > 0" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p class="text-center text-sm font-medium text-emerald-700">
                🎉 You saved
                <span class="font-bold">
                    {{ formatPrice(discount) }}
                </span>
                on this order.
            </p>
        </div>

        <!-- Checkout Button -->
        <div class="mt-8">
            <checkoutButton @checkout="$emit('checkout')" />
        </div>

        <!-- Notice -->
        <div class="mt-5 rounded-2xl bg-indigo-50 px-4 py-3">
            <p class="text-center text-sm font-medium text-indigo-700">
                🚚 Free shipping on orders above $100
            </p>
        </div>

    </aside>
</template>

<script setup>
import { ClipboardDocumentListIcon } from "@heroicons/vue/24/outline";
import checkoutButton from "./checkoutButton.vue";
import summaryRow from "./summaryRow.vue";

defineProps({
    subtotal: {
        type: Number,
        default: 0,
    },

    discount: {
        type: Number,
        default: 0,
    },

    shipping: {
        type: Number,
        default: 0,
    },

    tax: {
        type: Number,
        default: 0,
    },

    total: {
        type: Number,
        default: 0,
    },
});

defineEmits([
    "checkout",
]);

function formatPrice(price) {
    return `$${Number(price).toFixed(2)}`;
}
</script>