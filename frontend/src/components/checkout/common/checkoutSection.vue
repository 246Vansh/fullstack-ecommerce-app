<template>
    <section class="rounded-panel border border-slate-200 bg-white" :aria-labelledby="headingId">

        <!-- Header: the step number and title. -->

        <div class="flex items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-6">

            <span aria-hidden="true"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                {{ Number(number) }}
            </span>

            <div class="min-w-0">

                <h2 :id="headingId" class="text-lg font-semibold text-slate-900">
                    {{ title }}
                </h2>

                <p v-if="subtitle" class="mt-0.5 text-sm text-slate-600">
                    {{ subtitle }}
                </p>

            </div>

        </div>

        <!-- Body -->

        <div class="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">

            <slot />

        </div>

    </section>
</template>

<script setup>
import { useId } from "vue";

defineProps({

    number: String,

    title: String,

    subtitle: String,

    // Kept so existing callers' props still bind; the header no longer shows an icon.
    icon: [Object, Function],

    // There is no section-level edit action, so no Edit button is rendered
    // (the address list has its own Edit buttons).
    editable: {
        type: Boolean,
        default: false,
    },

});

const headingId = useId();
</script>
