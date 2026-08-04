<template>
    <section class="space-y-8">

        <!-- Hero -->

        <section class="overflow-hidden rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50 to-blue-50">

            <div class="p-6 lg:p-8">

                <span class="inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
                    Product Specifications
                </span>

                <h2 class="mt-3 text-2xl font-bold text-gray-900">
                    Everything you need to know
                </h2>

                <p class="mt-4 max-w-3xl leading-8 text-gray-600">
                    Explore detailed product information including brand,
                    availability, pricing, colors, sizes and additional
                    purchasing benefits.
                </p>

            </div>

        </section>

        <!-- Information Cards -->

        <section>

            <div class="mb-8">

                <h3 class="text-2xl font-bold text-gray-900">
                    Product Information
                </h3>

                <p class="mt-2 text-gray-500">
                    Quick overview of the most important details.
                </p>

            </div>

            <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-4 cursor-pointer">

                <div v-for="item in basicInformation" :key="item.label"
                    class="group rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">

                    <div class="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl" :class="item.bg">

                        {{ item.icon }}

                    </div>

                    <p class="mt-6 text-xs font-semibold uppercase tracking-widest text-gray-400">

                        {{ item.label }}

                    </p>

                    <h3 class="mt-2 text-xl font-bold" :class="item.class">

                        {{ item.value }}

                    </h3>

                </div>

            </div>

        </section>

        <!-- Pricing -->

        <section
            class="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-xl">

            <!-- Header -->

            <div
                class="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 px-8 py-6">

                <div>

                    <h3 class="text-2xl font-bold text-gray-900">
                        Pricing Overview
                    </h3>

                    <p class="mt-1 text-gray-500">
                        Transparent pricing with exclusive savings.
                    </p>

                </div>

                <div class="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">

                    Save {{ discountPercentage }}%

                </div>

            </div>

            <!-- Content -->

            <div class="grid gap-6 p-6 md:grid-cols-3">

                <!-- Current Price -->

                <div class="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">

                    <p class="text-xs font-semibold uppercase tracking-widest text-gray-500">

                        Current Price

                    </p>

                    <h2 class="mt-3 text-2xl font-bold text-blue-600">

                        ${{ formattedPrice }}

                    </h2>

                    <p class="mt-2 text-sm text-gray-500">

                        Today's selling price

                    </p>

                </div>

                <!-- Original Price -->

                <div class="rounded-2xl border border-gray-200 bg-gray-50 p-6">

                    <p class="text-xs font-semibold uppercase tracking-widest text-gray-500">

                        Original Price

                    </p>

                    <h2 class="mt-3 text-2xl font-bold text-gray-400 line-through">

                        ${{ formattedOriginalPrice }}

                    </h2>

                    <p class="mt-2 text-sm text-gray-500">

                        Manufacturer's price

                    </p>

                </div>

                <!-- Savings -->

                <div class="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6">

                    <p class="text-xs font-semibold uppercase tracking-widest text-gray-500">

                        Total Savings

                    </p>

                    <h2 class="mt-3 text-2xl font-bold text-green-600">

                        ${{ savedAmount }}

                    </h2>

                    <p class="mt-2 text-sm font-medium text-green-700">

                        You save {{ discountPercentage }}%

                    </p>

                </div>

            </div>

        </section>

        <!-- Available Colors -->

        <!-- <section>

            <div class="mb-8">

                <h3 class="text-2xl font-bold text-gray-900">
                    Available Colors
                </h3>

                <p class="mt-2 text-gray-500">
                    Choose a color that matches your personality.
                </p>

            </div>

            <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 cursor-pointer">

                <div v-for="color in product.colors" :key="color.id"
                    class="group flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">

                    <span class="h-10 w-10 rounded-full border-2 border-gray-300 shadow-sm" :style="{
                        backgroundColor: color.hex || '#d1d5db'
                    }" />

                    <div class="flex-1">

                        <h4 class="font-semibold text-gray-900">

                            {{ color.name }}

                        </h4>

                        <p class="mt-1 text-sm text-gray-500">

                            Premium Finish

                        </p>

                    </div>

                </div>

            </div>

        </section>-->

        <!-- Sizes -->

        <!--<section>

            <div class="mb-8">

                <h3 class="text-2xl font-bold text-gray-900">
                    Available Sizes
                </h3>

                <p class="mt-2 text-gray-500">
                    Pick the perfect size for maximum comfort.
                </p>

            </div>

            <div class="flex flex-wrap gap-4">

                <button v-for="size in product.sizes" :key="size.id" type="button"
                    class="rounded-2xl border-2 border-gray-200 bg-white px-8 py-4 text-lg font-semibold transition-all duration-300 hover:-translate-y-1 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 cursor-pointer">

                    {{ size.name }}

                </button>

            </div>

        </section>-->

        <!-- Shopping Benefits -->

        <section class="rounded-3xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-6">

            <div class="mb-10">

                <h3 class="text-2xl font-bold text-gray-900">

                    Why Shop With Us?

                </h3>

                <p class="mt-2 text-gray-500">

                    Premium shopping experience with every purchase.

                </p>

            </div>

            <div class="grid gap-6 md:grid-cols-2 cursor-pointer">

                <div class="flex gap-5 rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-lg">

                    <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl">

                        🚚

                    </div>

                    <div>

                        <h4 class="text-lg font-semibold">

                            Fast Delivery

                        </h4>

                        <p class="mt-2 leading-7 text-gray-600">

                            Free delivery with secure packaging and
                            live order tracking.

                        </p>

                    </div>

                </div>

                <div class="flex gap-5 rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-lg">

                    <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-2xl">

                        🛡️

                    </div>

                    <div>

                        <h4 class="text-lg font-semibold">

                            Quality Guarantee

                        </h4>

                        <p class="mt-2 leading-7 text-gray-600">

                            Carefully inspected products with premium
                            craftsmanship.

                        </p>

                    </div>

                </div>

                <div class="flex gap-5 rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-lg">

                    <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-2xl">

                        🔄

                    </div>

                    <div>

                        <h4 class="text-lg font-semibold">

                            Easy Returns

                        </h4>

                        <p class="mt-2 leading-7 text-gray-600">

                            30-day hassle-free returns with a simple
                            refund process.

                        </p>

                    </div>

                </div>

                <div class="flex gap-5 rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-lg">

                    <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-2xl">

                        ⭐

                    </div>

                    <div>

                        <h4 class="text-lg font-semibold">

                            Trusted by Customers

                        </h4>

                        <p class="mt-2 leading-7 text-gray-600">

                            Thousands of satisfied customers love our
                            products and service.

                        </p>

                    </div>

                </div>

            </div>

        </section>

    </section>

</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

/* ---------------------------------
   Price Helpers
---------------------------------- */

const formattedPrice = computed(() =>
    Number(props.product.price || 0).toFixed(2)
);

const formattedOriginalPrice = computed(() =>
    Number(props.product.originalPrice || 0).toFixed(2)
);

const savedAmount = computed(() => {
    const original = Number(props.product.originalPrice || 0);
    const current = Number(props.product.price || 0);

    return Math.max(original - current, 0).toFixed(2);
});

const discountPercentage = computed(() => {
    const original = Number(props.product.originalPrice || 0);
    const current = Number(props.product.price || 0);

    if (!original) return 0;

    return Math.round(((original - current) / original) * 100);
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

const basicInformation = computed(() => [
    {
        label: "Brand",
        value: props.product.brand?.name || "Unknown Brand",
        icon: "🏷️",
        bg: "bg-blue-100",
        class: "text-gray-900",
    },

    {
        label: "Category",
        value: props.product.category?.name || "General",
        icon: "👕",
        bg: "bg-purple-100",
        class: "text-gray-900",
    },

    {
        label: "Availability",
        value: inStock.value ? "In Stock" : "Out of Stock",
        icon: "📦",
        bg: inStock.value
            ? "bg-green-100"
            : "bg-red-100",
        class: inStock.value
            ? "text-green-600"
            : "text-red-600",
    },

    {
        label: "Rating",
        value: `${props.product.rating ?? 0} ★ (${props.product.reviewCount ?? 0} Reviews)`,
        icon: "⭐",
        bg: "bg-yellow-100",
        class: "text-gray-900",
    },
]);

/* ---------------------------------
   Fallback Colors
---------------------------------- */

const colorMap = {
    Black: "#000000",
    White: "#ffffff",
    Gray: "#6b7280",
    Grey: "#6b7280",
    Blue: "#2563eb",
    Navy: "#1e3a8a",
    Red: "#dc2626",
    Green: "#16a34a",
    Yellow: "#facc15",
    Orange: "#f97316",
    Purple: "#9333ea",
    Pink: "#ec4899",
    Brown: "#8b5e3c",
    Beige: "#d6c6a8",
};

const colors = computed(() => {
    return (props.product.colors || []).map((color) => ({
        ...color,
        hex:
            color.hex ||
            colorMap[color.name] ||
            "#d1d5db",
    }));
});
</script>