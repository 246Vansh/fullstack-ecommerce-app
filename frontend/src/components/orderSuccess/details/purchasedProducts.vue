<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-8 sm:py-6">

            <div class="flex min-w-0 items-center gap-4">

                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100">

                    <CubeIcon class="h-6 w-6 text-indigo-600" />

                </div>

                <div>

                    <h2 class="text-xl font-bold text-slate-900 sm:text-2xl">
                        Purchased Products
                    </h2>

                    <p class="text-sm text-slate-500">
                        Items included in your order
                    </p>

                </div>

            </div>

            <span class="shrink-0 rounded-full bg-indigo-100 px-3 py-1.5 text-sm sm:px-4 sm:py-2 font-semibold text-indigo-600">

                {{ products.length }} {{ products.length === 1 ? "Product" : "Products" }}

            </span>

        </div>

        <!-- Products -->

        <div class="hide-scrollbar lg:max-h-78 lg:overflow-y-auto lg:pr-2">

            <article v-for="product in products" :key="product.id"
                class="grid grid-cols-3 items-center gap-4 border-b border-gray-100 px-5 py-6 last:border-b-0 sm:px-8 lg:grid-cols-[110px_minmax(0,1fr)_120px_120px_120px] lg:gap-8 lg:py-7">

                <!-- Image -->

                <div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50 sm:h-24 sm:w-24">

                    <img v-if="product.image" :src="product.image" :alt="product.productName" class="h-16 w-16 object-contain sm:h-20 sm:w-20">

                </div>

                <!-- Product -->

                <div class="col-span-2 min-w-0 lg:col-span-1">

                    <h3 class="break-words text-base font-semibold text-slate-900 sm:text-lg">

                        {{ product.productName }}

                    </h3>

                    <p class="mt-2 text-sm text-slate-500">

                        SKU {{ product.sku }}

                    </p>

                    <div class="mt-4 flex flex-wrap gap-2">

                        <span v-for="option in [product.color, product.size].filter(Boolean)" :key="option"
                            class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm">

                            {{ option }}

                        </span>

                    </div>

                </div>

                <!-- Price -->

                <div class="text-center">

                    <p class="text-sm text-slate-500 lg:text-xl lg:text-black">
                        Price
                    </p>

                    <h3 class="mt-2 text-base font-bold sm:text-lg">

                        {{ formatPrice(product.unitPrice) }}

                    </h3>

                </div>

                <!-- Quantity -->

                <div class="text-center">

                    <p class="text-sm text-slate-500">
                        Quantity
                    </p>

                    <span class="mt-2 inline-flex rounded-xl bg-indigo-100 px-4 py-2 font-semibold text-indigo-600">

                        {{ product.quantity }}

                    </span>

                </div>

                <!-- Total -->

                <div class="text-right">

                    <p class="text-sm text-slate-500 lg:text-xl lg:text-black">
                        Total
                    </p>

                    <h3 class="mt-2 text-base font-semibold text-orange-600 sm:text-xl">

                        {{ formatPrice(product.lineTotal) }}

                    </h3>

                </div>

            </article>

        </div>

    </section>

</template>

<script setup>
import { CubeIcon } from "@heroicons/vue/24/outline";

import { formatPrice } from "@/composables/useOrderSuccess";

// Order item snapshots: names and prices as they were when the order was placed.
defineProps({

    products: {
        type: Array,
        default: () => [],
    },

});


</script>

<style scoped>
.hide-scrollbar {
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.hide-scrollbar::-webkit-scrollbar {
    display: none;
}
</style>