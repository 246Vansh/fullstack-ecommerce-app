<template>

    <section class="border-t border-slate-100 px-5 py-4 sm:px-6" aria-labelledby="coupon-heading">

        <h3 id="coupon-heading" class="text-sm font-semibold text-slate-900">Coupon code</h3>

        <!-- Applied (from the server's checkout response) -->

        <div v-if="applied" class="mt-3 flex items-start gap-3 rounded-control border border-brand/25 bg-brand-soft px-3 py-2.5">
            <TicketIcon class="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <div class="min-w-0 flex-1">
                <p class="wrap-anywhere font-mono text-sm font-semibold text-brand">{{ applied.code }}</p>
                <p class="text-xs text-slate-700">
                    {{ couponTerms(applied) }} · you save {{ formatPrice(applied.discount, applied.currency) }}
                </p>
            </div>
            <button type="button" :disabled="disabled"
                class="inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-control px-2 text-sm font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-900 outline-brand focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                @click="$emit('remove')">
                Remove<span class="sr-only"> coupon {{ applied.code }}</span>
            </button>
        </div>

        <!-- Entry -->

        <form v-else class="mt-3 flex gap-2" novalidate @submit.prevent="submit">
            <label for="coupon-code" class="sr-only">Coupon code</label>
            <input id="coupon-code" v-model="code" type="text" maxlength="40" autocomplete="off"
                autocapitalize="characters" spellcheck="false" placeholder="Enter code" :disabled="disabled"
                :aria-invalid="error ? 'true' : undefined" :aria-describedby="error ? 'coupon-error' : undefined"
                class="block min-h-11 w-full min-w-0 rounded-control border bg-white px-3 py-2 font-mono text-base uppercase text-slate-900 placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-3 disabled:cursor-not-allowed disabled:bg-slate-100 sm:text-sm"
                :class="error
                    ? 'border-red-600 focus:border-red-600 focus:ring-red-600/20'
                    : 'border-slate-300 hover:border-slate-400 focus:border-brand focus:ring-brand/20'" />
            <PrimaryButton tag="button" type="submit" variant="outline" class="shrink-0" :loading="applying"
                :disabled="disabled || !code.trim()">
                {{ applying ? "Applying…" : "Apply" }}
            </PrimaryButton>
        </form>

        <p v-if="error" id="coupon-error" role="alert" class="mt-2 flex items-start gap-1 text-xs leading-5 font-medium text-red-700">
            <ExclamationCircleIcon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {{ error }}
        </p>

    </section>

</template>

<script setup>
import { ref } from "vue";
import { TicketIcon } from "@heroicons/vue/24/outline";
import { ExclamationCircleIcon } from "@heroicons/vue/20/solid";

import PrimaryButton from "@/components/ui/primaryButton.vue";
import { formatPrice } from "@/utils/money";
import { couponTerms } from "@/utils/couponRules";

defineProps({

    // checkout.coupon from the server (null: none applied).
    applied: { type: Object, default: null },

    applying: Boolean,

    // Why the last code was refused or removed ("" when none).
    error: { type: String, default: "" },

    // An order is being placed or totals are loading.
    disabled: Boolean,

});

const emit = defineEmits(["apply", "remove"]);

const code = ref("");

// The server decides; once applied, this form is replaced by the applied state.
const submit = () => emit("apply", code.value);
</script>
