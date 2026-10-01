<template>
    <section class="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-start justify-between gap-4 px-5 py-6 sm:px-8 sm:py-7">

            <div class="flex min-w-0 gap-3 sm:gap-5">

                <!-- Number -->

                <div
                    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-base sm:h-14 sm:w-14 sm:text-lg font-bold text-indigo-600">

                    {{ number }}

                </div>

                <!-- Icon -->

                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 sm:h-14 sm:w-14">

                    <component :is="icon" class="h-6 w-6 text-indigo-600 sm:h-7 sm:w-7" />

                </div>

                <!-- Title -->

                <div class="min-w-0">

                    <h2 class="text-xl font-bold sm:text-2xl text-slate-900">

                        {{ title }}

                    </h2>

                    <p class="mt-1 text-slate-500">

                        {{ subtitle }}

                    </p>

                </div>

            </div>

            <!-- Edit -->

            <button v-if="editable"
                class="flex shrink-0 items-center gap-2 font-medium text-indigo-600 transition hover:text-indigo-700 cursor-pointer">

                <PencilSquareIcon class="h-5 w-5" />

                Edit

            </button>

        </div>

        <!-- Divider -->

        <div class="border-t border-gray-100" />

        <!-- Body -->

        <div class="px-5 py-6 sm:px-8 sm:py-7">

            <slot />

        </div>

    </section>
</template>

<script setup>
import { PencilSquareIcon } from "@heroicons/vue/24/outline";

defineProps({

    number: String,

    title: String,

    subtitle: String,

    icon: [Object, Function],

    editable: {
        type: Boolean,
        default: true,
    },

});
</script>