<template>
    <section
        class="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-50 p-5 shadow-sm">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <!-- Left Content -->
            <div class="flex items-center gap-5">
                <!-- Icon -->
                <div
                    class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg">
                    <GiftIcon class="h-8 w-8 text-white" />
                </div>

                <!-- Text -->
                <div>
                    <h3 class="flex flex-wrap items-center gap-2 text-2xl font-bold text-slate-900">
                        <span>🎉</span>

                        <span>
                            {{ title }}
                        </span>
                    </h3>

                    <p class="mt-1 text-lg text-gray-600">
                        {{ description }}
                    </p>
                </div>
            </div>

            <!-- Right Badge -->
            <div v-if="isFreeShipping" class="flex justify-start lg:justify-end">
                <div
                    class="inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-6 py-3 shadow-sm">
                    <span class="font-extrabold tracking-wide text-emerald-600">
                        FREE SHIPPING
                    </span>

                    <CheckIcon class="h-5 w-5 text-emerald-600" />
                </div>
            </div>

            <!-- Progress State -->
            <div v-else class="w-full max-w-sm">
                <p class="mb-3 text-sm font-semibold text-slate-700">
                    Spend
                    <span class="text-emerald-600">
                        ${{ remainingAmount }}
                    </span>
                    more for FREE Shipping
                </p>

                <div class="h-3 overflow-hidden rounded-full bg-emerald-100">
                    <div class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-500"
                        :style="{ width: `${progress}%` }" />
                </div>
            </div>
        </div>
    </section>
</template>

<script setup>
import {
    CheckIcon,
    GiftIcon,
} from "@heroicons/vue/24/solid";

import { computed } from "vue";

const props = defineProps({
    isFreeShipping: {
        type: Boolean,
        default: true,
    },

    remainingAmount: {
        type: Number,
        default: 0,
    },

    progress: {
        type: Number,
        default: 100,
    },
});

const title = computed(() =>
    props.isFreeShipping
        ? "Congratulations!"
        : "Almost There!"
);

const description = computed(() =>
    props.isFreeShipping
        ? "You've unlocked FREE shipping on your order."
        : "Add a few more items to unlock FREE shipping."
);
</script>