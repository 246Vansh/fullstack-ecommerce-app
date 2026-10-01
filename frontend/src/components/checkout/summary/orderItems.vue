<template>

    <section class="border-b border-gray-100 px-5 py-6 sm:px-8 sm:py-7">

        <!-- Header -->

        <div class="mb-6 flex items-center justify-between">

            <h3 class="text-lg font-bold text-slate-900">
                Order Items
            </h3>

            <span class="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-600">

                {{ products.length }} {{ products.length === 1 ? "Item" : "Items" }}

            </span>

        </div>

        <!-- Scroll Container -->

        <div class="pr-2" :class="{
            'max-h-[460px] overflow-y-auto hide-scrollbar': products.length > 4
        }">

            <div class="space-y-5">

                <article v-for="product in products" :key="product.id" class="flex items-center gap-4"
                    :class="{ 'rounded-2xl bg-red-50 p-2': product.issue }">

                    <!-- Image -->

                    <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-50">

                        <img :src="product.image" :alt="product.name" class="h-16 w-16 object-contain">

                    </div>

                    <!-- Details -->

                    <div class="min-w-0 flex-1">

                        <h4 class="truncate font-semibold text-slate-900">

                            {{ product.name }}

                        </h4>

                        <p class="mt-1 text-sm text-slate-500">

                            Qty {{ product.quantity }}

                            <template v-for="option in [product.color, product.size].filter(Boolean)" :key="option">
                                • {{ option }}
                            </template>

                        </p>

                        <!-- Why this item blocks checkout (from the server) -->
                        <p v-if="product.issue" class="mt-1 text-sm font-medium text-red-600">

                            {{ product.issue.message }}

                        </p>

                    </div>

                    <!-- Price -->

                    <div class="text-right">

                        <p class="font-bold text-slate-900">

                            {{ formatPrice(product.subtotal) }}

                        </p>

                        <p v-if="product.quantity > 1" class="text-xs text-slate-500">

                            {{ formatPrice(product.price) }} each

                        </p>

                    </div>

                </article>

            </div>

        </div>

    </section>

</template>

<script setup>

// Items and prices come from GET /api/checkout; they are only formatted here.
const formatPrice = (price) => `$${Number(price).toFixed(2)}`;

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