<template>
    <div class="mt-1 flex items-center gap-3">

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

const props = defineProps({

    price: {
        type: Number,
        required: true,
    },

    originalPrice: {
        type: Number,
        default: null,
    },

    currency: {
        type: String,
        default: "USD",
    },

});

const formatter = new Intl.NumberFormat("en-US", {

    style: "currency",
    currency: props.currency,

});

const formattedPrice = computed(() => {
    return formatter.format(props.price);

});

const formattedOriginalPrice = computed(() => {
    if (!props.originalPrice) return "";
    return formatter.format(props.originalPrice);

});

const showOriginalPrice = computed(() => {

    return (
        props.originalPrice !== null &&
        props.originalPrice > props.price
    );

});
</script>