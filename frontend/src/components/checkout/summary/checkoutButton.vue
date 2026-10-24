<template>
    <div class="border-t border-slate-100 px-5 py-5 sm:px-6">

        <PrimaryButton id="place-order-button" tag="button" size="lg" full-width :disabled="disabled" :loading="loading"
            :aria-describedby="describedBy" @click="$emit('place')">
            <LockClosedIcon v-if="!loading" class="h-5 w-5" aria-hidden="true" />
            {{ loading ? placingLabel(paymentMethod) : placeOrderLabel(paymentMethod) }}
        </PrimaryButton>

        <!-- Online payment happens in Razorpay's window; say so while it is open. -->
        <p v-if="loading && paymentMethod === 'RAZORPAY'" class="mt-3 text-center text-sm text-slate-600">
            Complete the payment in the secure Razorpay window. Please don't close this page.
        </p>

        <!-- Why the button is disabled (from the server's checkout validation). -->
        <p v-else-if="disabled && reason" id="place-order-reason" class="mt-3 text-center text-sm font-medium text-amber-800">
            {{ reason }}
        </p>

        <!-- The order request failed; the button is usable again. -->
        <p v-if="error" id="place-order-error" role="alert"
            class="mt-3 flex items-start gap-2 rounded-control border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800">
            <ExclamationCircleIcon class="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            {{ error }}
        </p>

    </div>
</template>

<script setup>
import { computed } from "vue";
import { ExclamationCircleIcon, LockClosedIcon } from "@heroicons/vue/24/outline";

import PrimaryButton from "@/components/ui/primaryButton.vue";
import { placeOrderLabel, placingLabel } from "./placeOrderLabel";

const props = defineProps({
    disabled: Boolean,
    loading: Boolean,

    // "COD" or "RAZORPAY": picks the wording only.
    paymentMethod: {
        type: String,
        default: "COD",
    },

    // Why the button is disabled ("" when it is not).
    reason: {
        type: String,
        default: "",
    },

    // The last Place Order failure.
    error: {
        type: String,
        default: "",
    },
});

defineEmits(["place"]);

const describedBy = computed(() => [
    props.disabled && props.reason && !props.loading ? "place-order-reason" : "",
    props.error ? "place-order-error" : "",
].filter(Boolean).join(" ") || undefined);
</script>
