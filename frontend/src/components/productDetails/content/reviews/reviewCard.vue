<template>
    <article class="rounded-xl border border-gray-200 p-6">

        <div class="flex items-start justify-between">

            <div>

                <div class="flex items-center gap-1">

                    <svg v-for="star in 5" :key="star" class="h-5 w-5"
                        :class="star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'"
                        viewBox="0 0 20 20">
                        <path
                            d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.783.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69z" />
                    </svg>

                </div>

                <h4 class="mt-3 text-sm font-semibold text-gray-900">
                    {{ review.reviewerName }}
                </h4>

                <p class="mt-1 text-xs text-gray-500">
                    {{ review.date }}
                </p>

            </div>

            <span class="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Verified Purchase
            </span>

        </div>

        <p class="mt-5 text-sm leading-6 text-gray-600">
            {{ review.comment }}
        </p>

    </article>
</template>

<script setup>
defineProps({
    review: {
        type: Object,
        required: true,
    },
});
</script>