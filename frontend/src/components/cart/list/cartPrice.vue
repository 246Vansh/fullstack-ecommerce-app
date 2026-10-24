<template>
    <div class="shrink-0 sm:text-right">

        <!-- Line subtotal from the server (none for an item no longer in the catalog) -->
        <p v-if="product.subtotal != null" class="text-base font-semibold text-slate-900">
            {{ formatPrice(product.subtotal, product.currency) }}
        </p>

        <!-- Unit price, with the original price when the item is marked down -->
        <p v-if="product.price != null && (product.quantity > 1 || percent > 0)" class="mt-0.5 text-sm text-slate-600">
            <span v-if="percent > 0" class="mr-1 text-slate-400 line-through">
                <span class="sr-only">Original price</span>
                {{ formatPrice(product.originalPrice, product.currency) }}
            </span>
            {{ formatPrice(product.price, product.currency) }} each
        </p>

        <span v-if="percent > 0"
            class="mt-1.5 inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
            {{ percent }}% off
        </span>

    </div>
</template>

<script setup>
import { computed } from "vue";
import { discountPercent, formatPrice } from "@/utils/money";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

// Only a real markdown (server originalPrice above the unit price) shows.
const percent = computed(() => (props.product.price == null ? 0 : discountPercent(props.product.price, props.product.originalPrice)));
</script>
