<template>

    <section class="rounded-panel border border-slate-200 bg-white" aria-labelledby="order-items-heading">

        <!-- Header -->

        <div class="flex items-center justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">

            <h2 id="order-items-heading" class="text-lg font-semibold text-slate-900">
                Items in this order
            </h2>

            <span class="shrink-0 text-sm text-slate-600">
                {{ products.length }} {{ products.length === 1 ? "product" : "products" }}
            </span>

        </div>

        <!-- Products (the whole list flows with the page; no hidden inner scroll) -->

        <ul class="mt-2 divide-y divide-slate-100 px-5 sm:px-6">

            <li v-for="product in products" :key="product.id" class="flex gap-4 py-4">

                <!-- Image (decorative: the name follows) -->

                <div class="w-16 shrink-0 overflow-hidden rounded-control bg-slate-100 ring-1 ring-slate-900/5 ring-inset sm:w-20">
                    <!-- 4:5 frame up to 80px wide; 240px covers 3x screens. -->
                    <img v-if="product.image" :src="sizedImage(product.image, 240)" alt="" class="aspect-4/5 w-full object-cover">
                    <span v-else class="block aspect-4/5 w-full" />
                </div>

                <!-- Product -->

                <div class="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">

                    <div class="min-w-0">

                        <h3 class="text-sm font-semibold text-slate-900 sm:text-base">
                            {{ product.productName }}
                        </h3>

                        <p class="mt-0.5 text-sm text-slate-600">
                            {{ [product.color, product.size].filter(Boolean).concat(`Qty ${product.quantity}`).join(" · ") }}
                        </p>

                        <p v-if="product.sku" class="mt-0.5 text-xs text-slate-500">
                            SKU {{ product.sku }}
                        </p>

                    </div>

                    <div class="shrink-0 sm:text-right">

                        <p class="text-sm font-semibold text-slate-900 sm:text-base">
                            {{ formatPrice(product.lineTotal, currency) }}
                        </p>

                        <p v-if="product.quantity > 1" class="text-xs text-slate-500">
                            {{ formatPrice(product.unitPrice, currency) }} each
                        </p>

                    </div>

                </div>

            </li>

        </ul>

    </section>

</template>

<script setup>
import { formatPrice } from "@/composables/useOrderSuccess";
import { sizedImage } from "@/utils/images";

// Order item snapshots: names and prices as they were when the order was placed.
defineProps({

    products: {
        type: Array,
        default: () => [],
    },

    // The order's stored currency (every item is priced in it).
    currency: {
        type: String,
        required: true,
    },

});
</script>
