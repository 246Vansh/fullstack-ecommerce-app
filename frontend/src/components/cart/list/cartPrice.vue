<template>
    <div class="flex flex-col items-end justify-around h-full">

        <div class="text-right">

            <!-- Current Price -->
            <h3 class="text-3xl font-bold text-slate-900">
                {{ formatPrice(product.price) }}
            </h3>

            <!-- Original Price -->
            <p v-if="hasDiscount" class="mt-1 text-lg text-gray-400 line-through">
                {{ formatPrice(product.originalPrice) }}
            </p>

        </div>

        <!-- Discount Badge -->
        <span v-if="hasDiscount"
            class="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-700">
            {{ discountPercentage }}% OFF
        </span>

    </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const hasDiscount = computed(() => {
    return (
        props.product.originalPrice &&
        props.product.originalPrice > props.product.price
    );
});

const discountPercentage = computed(() => {

    if (!hasDiscount.value) return 0;

    return Math.round(
        ((props.product.originalPrice - props.product.price) /
            props.product.originalPrice) *
        100
    );

});

function formatPrice(price) {
    return `$${Number(price).toFixed(2)}`;
}
</script>