<template>
    <div class="space-y-10">

        <!-- About Product -->
        <section class="overflow-hidden rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50 to-blue-50">

            <div class="p-6 lg:p-8">
                <span class="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                    Premium Collection
                </span>

                <h2 class="mt-4 text-2xl font-bold text-gray-900">
                    About this product
                </h2>

                <p class="mt-5 leading-8 text-gray-600">
                    {{ product.description }}
                </p>

            </div>
        </section>

        <!-- Highlights -->

        <section>

            <h3 class="mb-6 text-xl font-semibold text-gray-900">
                Product Highlights
            </h3>

            <div class="grid gap-6 md:grid-cols-3 cursor-pointer">

                <div v-for="feature in features" :key="feature.title"
                    class="rounded-2xl border border-gray-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg">

                    <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl">

                        {{ feature.icon }}

                    </div>

                    <h4 class="font-semibold text-gray-900">
                        {{ feature.title }}
                    </h4>

                    <p class="mt-2 text-sm leading-6 text-gray-500">
                        {{ feature.description }}
                    </p>

                </div>

            </div>

        </section>

        <!-- Material & Care -->

        <section class="grid gap-6 md:grid-cols-2">

            <!-- Material -->

            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-6">

                <h3 class="flex items-center gap-2 text-lg font-semibold text-gray-900">

                    🧵 Material

                </h3>

                <p class="mt-4 leading-7 text-gray-600">

                    Crafted using premium-quality fabrics that provide
                    exceptional comfort, breathability and durability for
                    everyday wear.

                </p>

            </div>

            <!-- Care -->

            <div class="rounded-2xl border border-gray-200 bg-gray-50 p-6">

                <h3 class="flex items-center gap-2 text-lg font-semibold text-gray-900">

                    🧺 Care Instructions

                </h3>

                <ul class="mt-4 space-y-3">

                    <li v-for="instruction in careInstructions" :key="instruction"
                        class="flex items-center gap-3 text-gray-600">

                        <span
                            class="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-600">

                            ✓

                        </span>

                        {{ instruction }}

                    </li>

                </ul>

            </div>

        </section>

    </div>
</template>

<script setup>
const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const features = [
    {
        icon: "✨",
        title: "Premium Quality",
        description:
            "Made from carefully selected materials for long-lasting comfort.",
    },
    {
        icon: "🌬️",
        title: "Breathable",
        description:
            "Lightweight construction keeps you comfortable all day.",
    },
    {
        icon: "🎯",
        title: "Modern Fit",
        description:
            "Designed with a timeless silhouette that suits every occasion.",
    },
];

const careInstructions = [
    "Machine wash cold",
    "Do not bleach",
    "Tumble dry low",
    "Iron on low heat",
];
</script>