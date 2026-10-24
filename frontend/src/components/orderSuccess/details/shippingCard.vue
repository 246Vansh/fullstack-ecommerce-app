<template>

    <section class="rounded-panel border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="order-shipping-heading">

        <h2 id="order-shipping-heading" class="text-lg font-semibold text-slate-900">
            Shipping address
        </h2>

        <!-- The address snapshot stored on the order. No delivery method: orders do not store one yet. -->

        <address class="mt-3 space-y-0.5 text-sm leading-6 text-slate-600 not-italic">

            <p class="font-medium text-slate-900">
                {{ address.firstName }} {{ address.lastName }}
            </p>

            <p>{{ [address.address, address.apartment].filter(Boolean).join(", ") }}</p>

            <p>{{ address.city }}, {{ address.state }} {{ address.zipCode }}</p>

            <p>{{ address.country }}</p>

            <p v-if="address.phone" class="pt-1">{{ address.phone }}</p>

        </address>

    </section>

</template>

<script setup>
// The shipping address snapshot stored on the order.
defineProps({
    address: {
        type: Object,
        required: true,
    },
});
</script>
