<template>
    <div class="inline-flex shrink-0 items-center rounded-control border border-slate-300 bg-white" role="group"
        aria-label="Quantity">

        <!-- aria-disabled rather than disabled, so focus stays on the button at a limit. -->
        <button type="button" aria-label="Decrease quantity" :aria-disabled="atMin || undefined" :class="STEP_CLASSES"
            @click="!atMin && $emit('decrease')">
            <MinusIcon class="h-4 w-4" aria-hidden="true" />
        </button>

        <!-- Announces the new value after a +/- press. -->
        <span aria-live="polite" aria-atomic="true"
            class="flex min-w-10 items-center justify-center text-base font-semibold text-slate-900 tabular-nums">
            <span class="sr-only">Quantity </span>{{ quantity }}
        </span>

        <!-- Stops at the selected option's stock; with no option (max null) it is not capped. -->
        <button type="button" aria-label="Increase quantity" :aria-disabled="atMax || undefined"
            :class="STEP_CLASSES" @click="!atMax && $emit('increase')">
            <PlusIcon class="h-4 w-4" aria-hidden="true" />
        </button>

    </div>
</template>

<script setup>
import { computed } from "vue";
import { MinusIcon, PlusIcon } from "@heroicons/vue/20/solid";

const STEP_CLASSES = "flex h-full min-h-12 w-11 items-center justify-center rounded-control text-slate-700 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:text-slate-300 aria-disabled:hover:bg-transparent";

const props = defineProps({
    quantity: {
        type: Number,
        required: true,
    },

    // The selected option's stock, or null when no option is selected.
    max: {
        type: Number,
        default: null,
    },
});

defineEmits([
    "increase",
    "decrease",
]);

const atMin = computed(() => props.quantity <= 1);

const atMax = computed(() => props.max !== null && props.max > 0 && props.quantity >= props.max);
</script>
