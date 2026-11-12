<template>

    <section class="overflow-hidden rounded-panel border border-slate-200 bg-white" aria-labelledby="checkout-summary-heading">

        <!-- Header -->

        <div class="px-5 pt-5 sm:px-6">

            <h2 id="checkout-summary-heading" class="text-lg font-semibold text-slate-900">
                Order summary
            </h2>

        </div>

        <orderInformation :customer="customer" :address="address" />

        <orderItems :products="products" />

        <couponField :applied="coupon" :applying="couponApplying" :error="couponError" :disabled="placing"
            @apply="$emit('apply-coupon', $event)" @remove="$emit('remove-coupon')" />

        <orderTotals :subtotal="subtotal" :discount="discount" :shipping="shipping" :tax="tax" :total="total"
            :currency="currency" :coupon-code="coupon?.code ?? ''" />

        <checkoutButton :disabled="!canProceed" :loading="placing" :payment-method="paymentMethod"
            :reason="blockedReason" :error="placeError" @place="$emit('place-order')" />

    </section>

</template>

<script setup>
import orderInformation from "./orderInformation.vue";
import orderItems from "./orderItems.vue";
import orderTotals from "./orderTotals.vue";
import couponField from "./couponField.vue";
import checkoutButton from "./checkoutButton.vue";

defineProps({

    products: Array,

    subtotal: Number,

    discount: Number,

    shipping: Number,

    tax: Number,

    total: Number,

    currency: String,

    customer: Object,

    address: Object,

    // From the server's checkout validation.
    canProceed: Boolean,

    // An order request is in flight.
    placing: Boolean,

    // The selected payment method (wording only).
    paymentMethod: {
        type: String,
        default: "COD",
    },

    // Why Place Order is disabled ("" when it is not).
    blockedReason: {
        type: String,
        default: "",
    },

    // The last Place Order failure.
    placeError: {
        type: String,
        default: "",
    },

    // The applied coupon from the server (null: none), and the apply state.
    coupon: {
        type: Object,
        default: null,
    },

    couponApplying: Boolean,

    couponError: {
        type: String,
        default: "",
    },

});

defineEmits(["place-order", "apply-coupon", "remove-coupon"]);
</script>
