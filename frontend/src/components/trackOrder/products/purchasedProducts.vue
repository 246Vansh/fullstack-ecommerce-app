<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-center gap-4 px-7 py-5">

            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-100">

                <ShoppingBagIcon class="h-6 w-6 text-green-600" />

            </div>

            <h2 class="text-xl font-bold text-slate-900">

                Items in this order ({{ products.length }})

            </h2>

        </div>

        <!-- Table Header -->

        <div
            class="grid grid-cols-[120px_minmax(0,1fr)_120px_120px_120px] border-b border-gray-100 px-7 py-4 text-sm font-medium text-slate-500">

            <span>Product</span>

            <span></span>

            <span class="text-center">Price</span>

            <span class="text-center">Quantity</span>

            <span class="text-right">Total</span>

        </div>

        <!-- Products -->

        <div class="max-h-62 overflow-y-auto hide-scrollbar">

            <article v-for="product in products" :key="product.id"
                class="grid grid-cols-[120px_minmax(0,1fr)_120px_120px_120px] items-center border-b border-gray-100 px-7 py-5 last:border-b-0">

                <!-- Image -->

                <div>

                    <div class="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-50">

                        <img :src="product.image" :alt="product.name" class="h-16 w-16 object-contain">

                    </div>

                </div>

                <!-- Product -->

                <div>

                    <h3 class="text-xl font-semibold text-slate-900">

                        {{ product.name }}

                    </h3>

                    <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">

                        <span>

                            Color:
                            {{ getColor(product) }}

                        </span>

                        <span>•</span>

                        <span>

                            Size:
                            {{ getSize(product) }}

                        </span>

                    </div>

                </div>

                <!-- Price -->

                <div class="text-center">

                    <span class="text-lg font-medium">

                        ${{ product.price }}

                    </span>

                </div>

                <!-- Quantity -->

                <div class="flex justify-center">

                    <span class="rounded-xl bg-green-100 px-4 py-2 font-semibold text-green-700">

                        {{ product.quantity }}

                    </span>

                </div>

                <!-- Total -->

                <div class="text-right">

                    <span class="text-xl font-bold text-slate-900">

                        ${{ (product.price * product.quantity).toFixed(2) }}

                    </span>

                </div>

            </article>

        </div>

    </section>

</template>

<script setup>

import { ShoppingBagIcon } from "@heroicons/vue/24/outline";

import { colors } from "@/constants/catalog/colors";
import { sizes } from "@/constants/catalog/sizes";

const props = defineProps({

    products: {

        type: Array,

        default: () => [],

    },

});

const getColor = (product) => {

    return product.colorIds
        ?.map(id => colors.find(color => color.id === id)?.name)
        .filter(Boolean)
        .join(", ") || "Unknown";

};

const getSize = (product) => {

    return product.sizeIds
        ?.map(id => sizes.find(size => size.id === id)?.name)
        .filter(Boolean)
        .join(", ") || "Unknown";

};

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