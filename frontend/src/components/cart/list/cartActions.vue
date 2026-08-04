<template>
    <div class="flex flex-col items-center justify-center">

        <div class="flex items-center overflow-hidden rounded-2xl border border-gray-200">
            <button class="flex h-12 w-12 items-center justify-center text-gray-500 transition hover:bg-gray-100 cursor-pointer"
                @click="decreaseQuantity">
                <MinusIcon class="h-5 w-5" />
            </button>

            <span class="flex w-12 justify-center font-semibold">
                {{ product.quantity }}
            </span>

            <button class="flex h-12 w-12 items-center justify-center text-gray-500 transition hover:bg-gray-100 cursor-pointer"
                @click="increaseQuantity">
                <PlusIcon class="h-5 w-5" />
            </button>
        </div>

        <button class="mt-5 flex items-center gap-2 font-medium text-red-500 transition hover:text-red-600 cursor-pointer"
            @click="$emit('removeProduct')">
            <TrashIcon class="h-5 w-5" />
            Remove
        </button>

    </div>
</template>

<script setup>
import {
    MinusIcon,
    PlusIcon,
    TrashIcon,
} from "@heroicons/vue/24/outline";

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

function increaseQuantity() {
    emit("updateQuantity", props.product.quantity + 1);
}

function decreaseQuantity() {
    if (props.product.quantity <= 1) return;

    emit("updateQuantity", props.product.quantity - 1);
}
</script>