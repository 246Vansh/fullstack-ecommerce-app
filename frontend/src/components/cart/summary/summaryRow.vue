<template>
    <div class="flex items-center justify-between py-4" :class="{
        'border-b border-gray-100': divider,
        'pt-6': isTotal
    }">

        <!-- Left -->
        <div class="flex items-center gap-2">

            <span :class="[
                isTotal
                    ? 'text-lg font-semibold text-slate-900'
                    : 'text-[15px] text-slate-600'
            ]">

                {{ label }}

            </span>

            <!-- Optional Info Icon -->
            <InformationCircleIcon v-if="showInfo" class="h-4 w-4 text-gray-400" />

        </div>

        <!-- Right -->
        <div :class="[
            isTotal
                ? 'text-2xl font-bold text-slate-900'
                : valueClass
        ]">

            {{ value }}

        </div>

    </div>
</template>

<script setup>
import { InformationCircleIcon } from "@heroicons/vue/24/outline";

defineProps({

    label: {
        type: String,
        required: true,
    },

    value: {
        type: [String, Number],
        required: true,
    },

    divider: {
        type: Boolean,
        default: false,
    },

    isTotal: {
        type: Boolean,
        default: false,
    },

    showInfo: {
        type: Boolean,
        default: false,
    },

    valueClass: {
        type: String,
        default: "font-semibold text-slate-900",
    },

});
</script>