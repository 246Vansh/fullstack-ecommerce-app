<template>
    <div class="mt-4 space-y-1">

        <!-- Brand. Without one the line stays as empty space (hidden from
             screen readers), so names and prices line up across a row. -->
        <p v-if="brand" class="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            {{ brand }}
        </p>
        <p v-else aria-hidden="true" class="text-xs">&nbsp;</p>

        <!-- Product Name: two lines at most, so prices line up across a row. -->
        <h3
            class="line-clamp-2 text-sm leading-6 font-medium text-slate-900 transition-colors duration-200 group-hover:text-brand sm:text-base">
            {{ name }}
        </h3>

    </div>
</template>

<script setup>
defineProps({

    brand: {
        type: String,
        default: "",
    },

    name: {
        type: String,
        required: true,
    },

});
</script>