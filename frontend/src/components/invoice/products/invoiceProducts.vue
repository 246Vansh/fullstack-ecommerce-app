<template>

    <section class="overflow-hidden rounded-t-2xl bg-white shadow-sm">

        <!-- Table Header -->

        <div
            class="grid grid-cols-[60px_minmax(0,1.6fr)_1.2fr_120px_140px_140px] bg-slate-900 px-8 py-5 text-sm font-semibold uppercase tracking-wide text-white">

            <span>#</span>

            <span>Item</span>

            <span>Description</span>

            <span class="text-center">Qty</span>

            <span class="text-right">Price</span>

            <span class="text-right">Total</span>

        </div>

        <!-- Products -->

        <div class="max-h-76 overflow-y-auto hide-scrollbar">
            <article v-for="(product, index) in products" :key="product.id"
                class="grid grid-cols-[60px_minmax(0,1.6fr)_1.2fr_120px_140px_140px] items-center border-b border-gray-100 px-8 py-6 last:border-b-0">

                <!-- Number -->

                <span class="font-bold text-slate-700">
                    {{ index + 1 }}
                </span>

                <!-- Product -->

                <div class="flex items-center gap-5">

                    <div class="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-50">

                        <img :src="product.image" :alt="product.name" class="h-12 w-12 object-contain">

                    </div>

                    <h3 class="text-lg font-semibold text-slate-900">
                        {{ product.name }}
                    </h3>

                </div>

                <!-- Description -->

                <div class="flex items-center gap-3 text-sm text-slate-500">

                    <span>
                        Color:{{ getColor(product) }}
                    </span>

                    <span>•</span>

                    <span>
                        Size:{{ getSize(product) }}
                    </span>

                </div>

                <!-- Qty -->

                <div class="text-center">

                    <span
                        class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 font-semibold text-green-700">
                        {{ product.quantity }}
                    </span>

                </div>

                <!-- Price -->

                <div class="text-right font-medium">
                    ${{ product.price.toFixed(2) }}
                </div>

                <!-- Total -->

                <div class="text-right text-lg font-bold text-slate-900">
                    ${{ (product.price * product.quantity).toFixed(2) }}
                </div>

            </article>
        </div>
    </section>

</template>

<script setup>


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