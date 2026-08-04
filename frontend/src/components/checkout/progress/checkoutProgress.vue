<template>
    <div class="flex items-center">

        <template v-for="(step, index) in steps" :key="step.id">

            <!-- Step -->

            <div class="flex flex-col items-center">

                <!-- Circle -->

                <div :class="[
                    'relative flex h-14 w-14 items-center justify-center rounded-full border transition-all duration-500',

                    isCompleted(step.id)
                        ? 'border-indigo-600 bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-200'
                        : isCurrent(step.id)
                            ? 'border-indigo-500 bg-white text-indigo-600 ring-8 ring-indigo-100'
                            : 'border-gray-200 bg-white text-gray-400'
                ]">

                    <component :is="step.icon" class="h-6 w-6" />

                </div>

                <!-- Label -->

                <span :class="[
                    'mt-3 text-sm font-semibold transition',

                    isCurrent(step.id)
                        ? 'text-slate-900'
                        : isCompleted(step.id)
                            ? 'text-indigo-600'
                            : 'text-gray-400'
                ]">

                    {{ step.label }}

                </span>

            </div>

            <!-- Connector -->

            <div v-if="index < steps.length - 1" class="relative mx-5 h-1 w-28 rounded-full bg-gray-200">

                <div v-if="index < currentIndex"
                    class="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-600 to-violet-500">
                </div>

            </div>

        </template>

    </div>
</template>

<script setup>
import { computed } from "vue";

import {
    ShoppingCartIcon,
    CreditCardIcon,
    CheckBadgeIcon,
} from "@heroicons/vue/24/solid";

const props = defineProps({

    currentStep: {
        type: String,
        default: "cart",
    },

});

const steps = [

    {
        id: "cart",
        label: "Cart",
        icon: ShoppingCartIcon,
    },

    {
        id: "checkout",
        label: "Checkout",
        icon: CreditCardIcon,
    },

    {
        id: "confirmation",
        label: "Confirmation",
        icon: CheckBadgeIcon,
    },

];

const currentIndex = computed(() =>

    steps.findIndex(

        step => step.id === props.currentStep

    )

);

function isCompleted(stepId) {

    return steps.findIndex(

        step => step.id === stepId

    ) < currentIndex.value;

}

function isCurrent(stepId) {

    return stepId === props.currentStep;

}
</script>