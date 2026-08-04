<template>
    <section>

        <div>
            <h2 class="text-2xl font-bold text-slate-900 px-1">
                You May Also Like
            </h2>
        </div>

        <!-- Products -->
        <div class="grid grid-cols-1 mt-4 gap-5 md:grid-cols-2 xl:grid-cols-4">

            <article v-for="product in products.slice(0, 4)" :key="product.id"
                class="group relative flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl">

                <!-- Wishlist -->
                <button class="absolute right-4 top-4 text-gray-400 transition hover:text-red-500 cursor-pointer"
                    @click="$emit('toggleWishlist', product.id)">
                    <HeartIcon class="h-5 w-5" />
                </button>

                <!-- Product Image -->
                <div class="flex h-32 w-28 shrink-0 items-center justify-center rounded-xl bg-slate-50">

                    <img :src="product.image" :alt="product.name"
                        class="h-20 w-20 object-contain transition duration-300 group-hover:scale-105">

                </div>

                <!-- Product Info -->
                <div class="flex min-w-0 flex-1 flex-col">

                    <h3 class="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">

                        {{ product.name }}

                    </h3>

                    <p class="mt-1 text-xs text-gray-500">

                        {{ product.category }}

                    </p>
                    <!-- Bottom -->
                    <div class="flex items-center justify-between">

                        <span class="text-lg font-bold text-slate-900">

                            ${{ product.price }}

                        </span>
                    </div>
                    <button class="mt-2 flex w-38 items-center justify-center gap-2 rounded-xl border border-indigo-100 py-3 font-semibold text-indigo-700
                        transition-all duration-300
                        bg-[radial-gradient(circle_at_82%_18%,rgba(99,102,241,0.24),transparent_48%),radial-gradient(circle_at_18%_8%,rgba(59,130,246,0.16),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f6f8ff_100%)]
                        hover:border-indigo-300
                        hover:shadow-md
                        hover:shadow-indigo-100/70
                        hover:bg-[radial-gradient(circle_at_82%_18%,rgba(99,102,241,0.30),transparent_50%),radial-gradient(circle_at_18%_8%,rgba(59,130,246,0.20),transparent_45%),linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)]
                        cursor-pointer" @click="$emit('addToCart', product)">
                        <ShoppingCartIcon class="h-5 w-5" />
                        Add to Cart
                    </button>
                </div>

            </article>

        </div>

    </section>
</template>

<script setup>
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    HeartIcon,
    ShoppingCartIcon,
} from "@heroicons/vue/24/outline";

defineProps({
    products: {
        type: Array,
        default: () => [],
    },
});

defineEmits([
    "addToCart",
    "toggleWishlist",
]);
</script>