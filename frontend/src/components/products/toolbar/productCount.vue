<template>
    <p class="text-sm text-slate-600">
        Showing

        <span class="font-semibold text-slate-900">
            {{ start }}–{{ end }}
        </span>

        of

        <span class="font-semibold text-slate-900">
            {{ total }}
        </span>

        {{ total === 1 ? "product" : "products" }}

    </p>
</template>

<script setup>

defineProps({

    start: {
        type: Number,
        required: true,
    },

    end: {
        type: Number,
        required: true,
    },

    total: {
        type: Number,
        required: true,
    },

});

</script>
