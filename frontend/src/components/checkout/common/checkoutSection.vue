<template>
    <section class="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">

        <!-- Header -->

        <div class="flex items-start justify-between px-8 py-7">

            <div class="flex gap-5">

                <!-- Number -->

                <div
                    class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-bold text-indigo-600">

                    {{ number }}

                </div>

                <!-- Icon -->

                <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">

                    <component :is="icon" class="h-7 w-7 text-indigo-600" />

                </div>

                <!-- Title -->

                <div>

                    <h2 class="text-2xl font-bold text-slate-900">

                        {{ title }}

                    </h2>

                    <p class="mt-1 text-slate-500">

                        {{ subtitle }}

                    </p>

                </div>

            </div>

            <!-- Edit -->

            <button v-if="editable"
                class="flex items-center gap-2 font-medium text-indigo-600 transition hover:text-indigo-700 cursor-pointer">

                <PencilSquareIcon class="h-5 w-5" />

                Edit

            </button>

        </div>

        <!-- Divider -->

        <div class="border-t border-gray-100" />

        <!-- Body -->

        <div class="px-8 py-7">

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

    icon: Object,

    editable: {
        type: Boolean,
        default: true,
    },

});
</script>