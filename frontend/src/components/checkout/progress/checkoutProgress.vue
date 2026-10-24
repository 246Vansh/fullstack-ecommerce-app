<template>
    <ol class="flex items-center gap-2 text-sm" aria-label="Checkout progress">

        <template v-for="(step, index) in steps" :key="step.id">

            <!-- Step -->

            <li class="flex items-center gap-2" :aria-current="isCurrent(step.id) ? 'step' : undefined">

                <span :class="[
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isCompleted(step.id)
                        ? 'bg-brand text-white'
                        : isCurrent(step.id)
                            ? 'bg-brand-soft text-brand ring-1 ring-brand'
                            : 'bg-slate-100 text-slate-500'
                ]" aria-hidden="true">
                    <CheckIcon v-if="isCompleted(step.id)" class="h-3.5 w-3.5" />
                    <template v-else>{{ index + 1 }}</template>
                </span>

                <span :class="[
                    'font-medium',
                    isCurrent(step.id) ? 'text-slate-900' : isCompleted(step.id) ? 'text-brand' : 'text-slate-500'
                ]">
                    {{ step.label }}
                    <span v-if="isCompleted(step.id)" class="sr-only">(completed)</span>
                </span>

            </li>

            <!-- Connector -->

            <li v-if="index < steps.length - 1" aria-hidden="true" class="h-px w-5 shrink-0 sm:w-8"
                :class="index < currentIndex ? 'bg-brand' : 'bg-slate-300'" />

        </template>

    </ol>
</template>

<script setup>
import { computed } from "vue";

import { CheckIcon } from "@heroicons/vue/20/solid";

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
    },

    {
        id: "checkout",
        label: "Checkout",
    },

    {
        id: "confirmation",
        label: "Confirmation",
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
