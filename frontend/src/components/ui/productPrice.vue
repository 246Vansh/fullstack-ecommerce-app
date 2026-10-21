<template>
    <div class="mt-1 flex flex-wrap items-center gap-x-3">

        <!-- Current Price -->
        <span class="text-lg font-semibold text-gray-900">
            {{ formattedPrice }}
        </span>

        <!-- Original Price -->
        <span v-if="showOriginalPrice" class="text-sm text-gray-500 line-through">
            {{ formattedOriginalPrice }}
        </span>

    </div>
</template>

<script setup>
import { computed } from "vue";

import { formatPrice } from "@/utils/money";

const props = defineProps({

    price: {
        type: Number,
        required: true,
    },

    originalPrice: {
        type: Number,
        default: null,
    },

    // The product's currency; there is no default, so a price is never shown in a guessed one.
    currency: {
        type: String,
        required: true,
    },

});

const formattedPrice = computed(() => {
    return formatPrice(props.price, props.currency);

});

const formattedOriginalPrice = computed(() => {
    if (!props.originalPrice) return "";
    return formatPrice(props.originalPrice, props.currency);

});

const showOriginalPrice = computed(() => {

    return (
        props.originalPrice !== null &&
        props.originalPrice > props.price
    );

});
</script>