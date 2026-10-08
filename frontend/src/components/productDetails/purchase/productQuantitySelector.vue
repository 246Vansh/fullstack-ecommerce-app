<template>
    <div class="rounded-2xl border border-gray-200 bg-gray-50 p-5">

        <div class="mb-5 flex items-center justify-between">

            <div>
                <h2 class="text-base font-semibold text-gray-900">
                    Quantity
                </h2>

                <p class="mt-1 text-sm text-gray-500">
                    Select the quantity
                </p>
            </div>

            <span class="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-800 shadow-sm">
                {{ quantity }} Item{{ quantity > 1 ? "s" : "" }}
            </span>

        </div>

        <div class="inline-flex overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm" role="group"
            aria-label="Quantity">

            <button type="button" aria-label="Decrease quantity"
                class="flex h-12 w-12 items-center justify-center text-xl font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-100 hover:text-black active:scale-95 cursor-pointer"
                @click="$emit('decrease')">
                −
            </button>

            <!-- Announces the new value after a +/- press. -->
            <span aria-live="polite" aria-atomic="true"
                class="flex h-12 min-w-[72px] items-center justify-center border-x border-gray-200 text-base font-semibold text-gray-900">
                <span class="sr-only">Quantity </span>{{ quantity }}
            </span>

            <button type="button" aria-label="Increase quantity"
                class="flex h-12 w-12 items-center justify-center text-xl font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-100 hover:text-black active:scale-95 cursor-pointer"
                @click="$emit('increase')">
                +
            </button>

        </div>

    </div>
</template>

<script setup>
defineProps({
    quantity: {
        type: Number,
        required: true,
    },
});

defineEmits([
    "increase",
    "decrease",
]);
</script>