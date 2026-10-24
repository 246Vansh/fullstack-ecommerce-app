<template>
    <div class="flex items-center justify-between gap-4 py-3" :class="{
        'border-b border-slate-100': divider,
    }">

        <!-- Left -->
        <div class="flex items-center gap-2">

            <span :class="[
                isTotal
                    ? 'text-base font-semibold text-slate-900'
                    : 'text-sm text-slate-600'
            ]">

                {{ label }}

            </span>

            <!-- Optional Info Icon -->
            <InformationCircleIcon v-if="showInfo" class="h-4 w-4 text-slate-400" aria-hidden="true" />

        </div>

        <!-- Right -->
        <div :class="[
            isTotal
                ? 'text-xl font-semibold tracking-tight text-slate-900'
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
        default: "text-sm font-semibold text-slate-900",
    },

});
</script>
