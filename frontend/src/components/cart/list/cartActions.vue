<template>
    <div class="flex flex-wrap items-center justify-between gap-3">

        <div class="inline-flex items-center rounded-control border border-slate-300 bg-white" role="group"
            :aria-label="`Quantity for ${product.name}`">

            <!-- aria-disabled rather than disabled, so focus stays on the button at a limit. -->
            <button type="button" :aria-label="`Decrease quantity for ${product.name}`" :aria-disabled="atMin || undefined"
                :class="STEP_CLASSES" @click="decreaseQuantity">
                <MinusIcon class="h-4 w-4" aria-hidden="true" />
            </button>

            <span class="flex min-w-10 justify-center text-sm font-semibold text-slate-900 tabular-nums">
                <span class="sr-only">Quantity </span>{{ product.quantity }}
            </span>

            <button type="button" :aria-label="`Increase quantity for ${product.name}`" :aria-disabled="atMax || undefined"
                :class="STEP_CLASSES" @click="increaseQuantity">
                <PlusIcon class="h-4 w-4" aria-hidden="true" />
            </button>
        </div>

        <button type="button" :aria-label="`Remove ${product.name} from cart`"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-medium text-slate-600 transition-colors hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer"
            @click="$emit('removeProduct')">
            <TrashIcon class="h-4 w-4" aria-hidden="true" />
            Remove
        </button>

    </div>
</template>

<script setup>
import { computed } from "vue";
import {
    MinusIcon,
    PlusIcon,
    TrashIcon,
} from "@heroicons/vue/24/outline";

const STEP_CLASSES = "flex h-11 w-11 items-center justify-center rounded-control text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:text-slate-300 aria-disabled:hover:bg-transparent";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits([
    "updateQuantity",
    "removeProduct",
]);

const atMin = computed(() => props.product.quantity <= 1);

// Every cart item carries its variant's stock (the server's for a signed-in
// cart, the catalog's for a guest), so + stops there. The server still checks.
const atMax = computed(() => typeof props.product.stock === "number" && props.product.quantity >= props.product.stock);

function increaseQuantity() {
    if (atMax.value) return;

    emit("updateQuantity", props.product.quantity + 1);
}

function decreaseQuantity() {
    if (atMin.value) return;

    emit("updateQuantity", props.product.quantity - 1);
}
</script>
