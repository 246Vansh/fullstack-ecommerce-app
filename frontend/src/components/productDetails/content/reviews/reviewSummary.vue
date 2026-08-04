<template>

    <div class="rounded-xl border border-gray-200 p-6">

        <div class="flex items-center gap-4">

            <span class="text-5xl font-bold text-gray-900">
                {{ averageRating.toFixed(1) }}
            </span>

            <div>

                <div class="flex">

                    <svg v-for="star in 5" :key="star" class="h-5 w-5" :class="star <= Math.round(averageRating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'fill-gray-200 text-gray-200'" viewBox="0 0 20 20">
                        <path
                            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69z" />
                    </svg>

                </div>

                <p class="mt-2 text-sm text-gray-500">
                    Based on {{ totalReviews }} reviews
                </p>

            </div>

        </div>

        <div class="mt-8 space-y-3">

            <div v-for="item in breakdown" :key="item.star" class="flex items-center gap-4">

                <span class="w-6 text-sm text-gray-600">
                    {{ item.star }}
                </span>

                <div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">

                    <div class="h-full rounded-full bg-yellow-400" :style="{ width: item.percentage + '%' }" />

                </div>

                <span class="w-10 text-right text-sm text-gray-500">
                    {{ item.count }}
                </span>

            </div>

        </div>

    </div>

</template>

<script setup>
defineProps({
    averageRating: Number,
    totalReviews: Number,
    breakdown: Array,
});
</script>