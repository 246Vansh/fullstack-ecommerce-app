<template>

    <section class="overflow-hidden rounded-xl bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-center justify-between border-b border-gray-100 px-8 py-6">

            <div class="flex items-center gap-4">

                <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100">

                    <CubeIcon class="h-6 w-6 text-indigo-600" />

                </div>

                <div>

                    <h2 class="text-2xl font-bold text-slate-900">
                        Purchased Products
                    </h2>

                    <p class="text-sm text-slate-500">
                        Items included in your order
                    </p>

                </div>

            </div>

            <span class="rounded-full bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-600">

                {{ products.length }} Products

            </span>

        </div>

        <!-- Products -->

        <div class="max-h-78 overflow-y-auto pr-2 hide-scrollbar">

            <article v-for="product in products" :key="product.id"
                class="grid items-center gap-8 border-b border-gray-100 px-8 py-7 last:border-b-0 lg:grid-cols-[110px_minmax(0,1fr)_120px_120px_120px]">

                <!-- Image -->

                <div class="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-50">

                    <img :src="product.image" :alt="product.name" class="h-20 w-20 object-contain">

                </div>

                <!-- Product -->

                <div>

                    <h3 class="text-lg font-semibold text-slate-900">

                        {{ product.name }}

                    </h3>

                    <p class="mt-2 text-sm text-slate-500">

                        {{ product.brand }}

                    </p>

                    <div class="mt-4 flex flex-wrap gap-2">

                        <span class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm">

                            {{ getColor(product) }}

                        </span>

                        <span class="rounded-lg bg-slate-100 px-3 py-1.5 text-sm">

                            {{ getSize(product) }}

                        </span>

                    </div>

                </div>

                <!-- Price -->

                <div class="text-center">

                    <p class="text-xl text-black">
                        Price
                    </p>

                    <h3 class="mt-2 text-lg font-bold">

                        ${{ product.price }}

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

                    <p class="text-xl text-black">
                        Total
                    </p>

                    <h3 class="mt-2 text-xl font-semibold text-orange-600">

                        ${{ (product.price * product.quantity).toFixed(2) }}

                    </h3>

                </div>

            </article>

        </div>

    </section>

</template>

<script setup>
import { CubeIcon } from "@heroicons/vue/24/outline";
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