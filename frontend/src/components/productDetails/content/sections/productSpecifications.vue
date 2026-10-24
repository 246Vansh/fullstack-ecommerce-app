<template>
    <section class="max-w-3xl">

        <h2 class="text-xl font-semibold tracking-tight text-slate-900">
            Specifications
        </h2>

        <!-- Only fields the API returns: brand, category, stock and pricing. -->
        <dl class="mt-6 divide-y divide-slate-200 border-y border-slate-200">

            <div v-for="item in details" :key="item.label" class="grid grid-cols-[minmax(0,10rem)_1fr] gap-4 py-4 text-sm">

                <dt class="font-medium text-slate-500">
                    {{ item.label }}
                </dt>

                <dd class="font-medium" :class="item.class ?? 'text-slate-900'">
                    {{ item.value }}
                </dd>

            </div>

        </dl>

    </section>
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

/* ---------------------------------
   Price Helpers
---------------------------------- */

const percent = computed(() => discountPercent(props.product.price, props.product.originalPrice));

const savedAmount = computed(() => {
    const original = Number(props.product.originalPrice || 0);
    const current = Number(props.product.price || 0);

    return formatPrice(Math.max(original - current, 0), props.product.currency);
});

/* ---------------------------------
   Stock Status
---------------------------------- */

const inStock = computed(() => {
    if (typeof props.product.inStock === "boolean") {
        return props.product.inStock;
    }

    if (typeof props.product.stock === "number") {
        return props.product.stock > 0;
    }

    return false;
});

/* ---------------------------------
   Product Information
---------------------------------- */

// Original price and savings only exist for products that are actually marked down.
const details = computed(() => [
    {
        label: "Brand",
        value: props.product.brand?.name || props.product.brand || "Unknown Brand",
    },

    {
        label: "Category",
        value: props.product.category?.name || "General",
    },

    {
        label: "Availability",
        value: inStock.value ? "In Stock" : "Out of Stock",
        class: inStock.value ? "text-brand" : "text-red-700",
    },

    {
        label: "Price",
        value: formatPrice(props.product.price, props.product.currency),
    },

    ...(percent.value > 0
        ? [
            {
                label: "Original price",
                value: formatPrice(props.product.originalPrice, props.product.currency),
                class: "text-slate-500 line-through",
            },
            {
                label: "You save",
                value: `${savedAmount.value} (${percent.value}%)`,
                class: "text-brand",
            },
        ]
        : []),
]);
</script>
