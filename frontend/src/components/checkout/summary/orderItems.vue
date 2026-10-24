<template>

    <section class="border-t border-slate-100 px-5 py-4 sm:px-6" aria-labelledby="checkout-items-heading">

        <!-- Header -->

        <div class="mb-4 flex items-center justify-between">

            <h3 id="checkout-items-heading" class="text-sm font-semibold text-slate-900">
                Items
            </h3>

            <span class="text-sm text-slate-600">
                {{ products.length }} {{ products.length === 1 ? "product" : "products" }}
            </span>

        </div>

        <!-- Flows with the summary: no hidden inner scroll area. -->

        <ul class="space-y-4">

            <li v-for="product in products" :key="product.id" class="flex items-center gap-3"
                :class="{ 'rounded-control bg-red-50 p-2 ring-1 ring-red-200': product.issue }">

                <!-- Image (decorative: the name follows) -->

                <div class="relative w-14 shrink-0">
                    <div class="overflow-hidden rounded-control bg-slate-100 ring-1 ring-slate-900/5 ring-inset">
                        <!-- 4:5 frame 56px wide; 200px covers 3x screens. -->
                        <img v-if="product.image" :src="sizedImage(product.image, 200)" alt="" class="aspect-4/5 w-full object-cover">
                        <span v-else class="block aspect-4/5 w-full" />
                    </div>
                    <span class="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-xs font-semibold text-white"
                        aria-hidden="true">
                        {{ product.quantity }}
                    </span>
                </div>

                <!-- Details -->

                <div class="min-w-0 flex-1">

                    <p class="truncate text-sm font-medium text-slate-900">
                        {{ product.name }}
                    </p>

                    <p class="mt-0.5 text-xs text-slate-600">
                        Qty {{ product.quantity }}<template v-for="option in [product.color, product.size].filter(Boolean)" :key="option"> · {{ option }}</template>
                    </p>

                    <!-- Why this item blocks checkout (from the server) -->
                    <p v-if="product.issue" class="mt-1 text-xs font-medium text-red-700">
                        {{ product.issue.message }}
                    </p>

                </div>

                <!-- Price -->

                <div class="text-right">

                    <p class="text-sm font-semibold text-slate-900">
                        {{ formatPrice(product.subtotal, product.currency) }}
                    </p>

                    <p v-if="product.quantity > 1" class="text-xs text-slate-500">
                        {{ formatPrice(product.price, product.currency) }} each
                    </p>

                </div>

            </li>

        </ul>

    </section>

</template>

<script setup>
import { formatPrice } from "@/utils/money";
import { sizedImage } from "@/utils/images";

// Items and prices come from GET /api/checkout; they are only formatted here.

defineProps({

    products: {
        type: Array,
        default: () => [],
    },

});

</script>
