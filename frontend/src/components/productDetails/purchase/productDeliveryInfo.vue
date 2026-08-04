<template>

    <div class="space-y-5 border-t border-gray-200 pt-8">

        <DeliveryItem icon="🚚" title="Free Shipping" description="Free delivery on orders over $100." />

        <DeliveryItem icon="↩️" title="Easy Returns" description="30-day hassle-free return policy." />

        <DeliveryItem icon="🛡️" title="Warranty" description="Covered by the manufacturer's warranty." />

        <DeliveryItem icon="🔒" title="Secure Payment" description="Your payment information is encrypted." />

    </div>

</template>

<script setup>
import DeliveryItem from "./deliveryItem.vue";
</script>