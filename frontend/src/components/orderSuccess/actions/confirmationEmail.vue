<template>

    <section class="mt-8 rounded-[28px] border border-green-200 bg-green-50 px-5 py-6 sm:px-8">

        <div class="flex items-center gap-4">

            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-600">

                <EnvelopeIcon class="h-6 w-6 text-white" />

            </div>

            <div class="min-w-0">

                <h3 class="text-lg font-semibold text-slate-900">

                    Order Updates

                </h3>

                <p class="mt-1 text-slate-600">

                    Updates about this order will be sent to
                    <strong class="break-all">{{ email }}</strong>.

                </p>

            </div>

        </div>

    </section>

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