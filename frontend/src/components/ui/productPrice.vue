<template>
    <div :class="['flex flex-wrap items-baseline', size === 'lg' ? 'gap-x-3 gap-y-2' : 'mt-1 gap-x-2']">

        <!-- Current Price -->
        <span :class="currentClasses">
            <span v-if="hasDiscount" class="sr-only">Sale price</span>
            {{ formattedPrice }}
        </span>

        <!-- Original Price -->
        <span v-if="hasDiscount" :class="size === 'lg' ? 'text-lg text-slate-500 line-through' : 'text-sm text-slate-500 line-through'">
            <span class="sr-only">Original price</span>
            {{ formattedOriginalPrice }}
        </span>

        <!-- Savings (large size only; cards show a badge on the photo instead) -->
        <span v-if="hasDiscount && size === 'lg'"
            class="inline-flex items-center rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
            Save {{ percent }}%
        </span>

    </div>
</template>

<script setup>
import { computed } from "vue";

import { discountPercent, formatPrice } from "@/utils/money";

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

    // "md" for product cards, "lg" for the product details summary.
    size: {
        type: String,
        default: "md",
    },

});

const formattedPrice = computed(() => {
    return formatPrice(props.price, props.currency);

});

const formattedOriginalPrice = computed(() => {
    if (!props.originalPrice) return "";
    return formatPrice(props.originalPrice, props.currency);

});

const percent = computed(() => discountPercent(props.price, props.originalPrice));

const hasDiscount = computed(() => percent.value > 0);

const currentClasses = computed(() => [
    "font-semibold tracking-tight",
    props.size === "lg" ? "text-3xl text-slate-900" : "text-base text-slate-900 sm:text-lg",
    hasDiscount.value && props.size !== "lg" ? "text-brand" : "",
]);
</script>
