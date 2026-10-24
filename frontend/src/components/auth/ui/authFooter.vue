<template>

    <div class="text-center">

        <p class="text-sm text-slate-600">

            {{ text }}

            <RouterLink :to="to"
                class="ml-1 rounded-sm font-semibold text-brand underline decoration-brand/30 underline-offset-4 transition-colors duration-200 hover:text-brand-hover hover:decoration-current outline-brand focus-visible:outline-2 focus-visible:outline-offset-2">
                {{ linkText }}
            </RouterLink>

        </p>

    </div>

</template>

<script setup>
import { RouterLink } from "vue-router";

defineProps({

    text: {
        type: String,
        required: true,
    },

    linkText: {
        type: String,
        required: true,
    },

    to: {
        type: String,
        required: true,
    },

});
</script>
