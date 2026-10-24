<template>

    <p class="flex items-start gap-3 rounded-card bg-white px-5 py-4 text-sm text-slate-600 ring-1 ring-slate-200">

        <EnvelopeIcon class="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />

        <span>
            The contact email on this order is
            <strong class="font-semibold break-all text-slate-900">{{ email }}</strong>.
        </span>

    </p>

</template>

<script setup>
import { EnvelopeIcon } from "@heroicons/vue/24/outline";

defineProps({
    // The email captured on the order.
    email: {
        type: String,
        required: true,
    },
});
</script>
