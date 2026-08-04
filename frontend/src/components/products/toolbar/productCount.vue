<template>
    <p class="text-sm text-gray-700">
        Showing

        <span class="font-semibold text-gray-900">
            {{ start }}
        </span>

        -

        <span class="font-semibold text-gray-900">
            {{ end }}
        </span>

        of

        <span class="font-semibold text-gray-900">
            {{ total }}
        </span>

        products

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