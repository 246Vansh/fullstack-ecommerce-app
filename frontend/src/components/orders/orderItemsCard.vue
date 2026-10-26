<template>

    <section class="rounded-panel border border-slate-200 bg-white" aria-labelledby="order-items-heading">

        <div class="flex items-baseline justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 id="order-items-heading" class="text-base font-semibold text-slate-900">
                Items in this order
            </h2>
            <span class="shrink-0 text-sm text-slate-500">
                {{ items.length }} {{ items.length === 1 ? "product" : "products" }}
            </span>
        </div>

        <ul class="mt-1 divide-y divide-slate-100 px-5 sm:px-6">

            <li v-for="item in items" :key="item.id" class="flex gap-4 py-4 sm:gap-6 sm:py-5">

                <!-- Image (decorative: the name follows). Missing or broken images get a placeholder.
                     Up to 112px wide; 336px covers 3x screens. -->
                <div class="w-22 shrink-0 overflow-hidden rounded-control bg-slate-100 ring-1 ring-slate-900/5 ring-inset sm:w-28">
                    <img v-if="item.image && !broken.has(item.id)" :src="sizedImage(item.image, 336)" alt=""
                        loading="lazy" class="aspect-4/5 w-full object-cover" @error="markBroken(item.id)">
                    <span v-else class="flex aspect-4/5 w-full items-center justify-center text-slate-400">
                        <PhotoIcon class="h-7 w-7" aria-hidden="true" />
                    </span>
                </div>

                <div class="flex min-w-0 flex-1 flex-col justify-between gap-2 sm:flex-row sm:gap-6">

                    <div class="min-w-0">
                        <h3 class="text-sm font-semibold leading-snug text-slate-900 wrap-anywhere sm:text-base">
                            {{ item.productName }}
                        </h3>
                        <p v-if="item.color || item.size" class="mt-1 text-sm text-slate-600">
                            {{ [item.color, item.size].filter(Boolean).join(" · ") }}
                        </p>
                        <p class="mt-1 text-sm text-slate-600">
                            Qty {{ item.quantity }}
                            <span v-if="item.quantity > 1" class="text-slate-500">
                                × {{ formatPrice(item.unitPrice, currency) }}
                            </span>
                        </p>
                        <p v-if="item.sku" class="mt-2 text-xs text-slate-500">SKU {{ item.sku }}</p>
                    </div>

                    <p class="shrink-0 text-sm font-semibold tabular-nums text-slate-900 sm:text-right sm:text-base">
                        {{ formatPrice(item.lineTotal, currency) }}
                    </p>

                </div>

            </li>

        </ul>

    </section>

</template>

<script setup>
import { reactive } from "vue";
import { PhotoIcon } from "@heroicons/vue/24/outline";

import { formatPrice } from "@/composables/useOrderSuccess";
import { sizedImage } from "@/utils/images";

// Order item snapshots: names and prices as they were when the order was placed.
defineProps({
    items: {
        type: Array,
        default: () => [],
    },
    // The order's stored currency (every item is priced in it).
    currency: {
        type: String,
        required: true,
    },
});

const broken = reactive(new Set());
const markBroken = (id) => broken.add(id);
</script>
