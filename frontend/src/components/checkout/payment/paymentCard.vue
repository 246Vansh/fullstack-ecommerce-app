<template>

    <checkoutSection number="03" title="Payment" :subtitle="subtitle" :icon="CreditCardIcon" :editable="false">

        <!-- Only the methods the server offers (online needs Razorpay keys on the server). -->
        <fieldset :disabled="disabled">
            <legend class="sr-only">Payment method</legend>

            <div class="grid gap-3">
                <label v-for="option in options" :key="option.value"
                    class="flex items-start gap-3 rounded-card border px-4 py-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand"
                    :class="[
                        modelValue === option.value ? 'border-brand bg-brand-soft/60' : 'border-slate-200 bg-white hover:border-slate-300',
                        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                    ]">
                    <input type="radio" name="payment-method" class="mt-0.5 h-4.5 w-4.5 shrink-0 accent-brand" :value="option.value"
                        :checked="modelValue === option.value" :disabled="disabled"
                        @change="$emit('update:modelValue', option.value)" />
                    <span class="min-w-0 flex-1">
                        <span class="flex items-center gap-2 font-semibold text-slate-900">
                            <component :is="option.icon" class="h-5 w-5 text-slate-500" aria-hidden="true" />
                            {{ option.label }}
                        </span>
                        <span class="mt-1 block text-sm text-slate-600">{{ option.note }}</span>
                    </span>
                </label>
            </div>

            <!-- While an order is being placed the choice is locked. -->
            <p v-if="disabled" class="mt-3 text-sm text-slate-600">
                Your payment method is locked while the order is being placed.
            </p>
        </fieldset>

    </checkoutSection>

</template>

<script setup>
import { computed } from "vue";
import { BanknotesIcon, CreditCardIcon } from "@heroicons/vue/24/outline";

import checkoutSection from "../common/checkoutSection.vue";

const props = defineProps({
    // Methods the server accepts, e.g. ["COD", "RAZORPAY"].
    methods: { type: Array, default: () => ["COD"] },
    modelValue: { type: String, default: "COD" },
    disabled: { type: Boolean, default: false },
});

defineEmits(["update:modelValue"]);

const ALL = [
    { value: "RAZORPAY", label: "Pay online", icon: CreditCardIcon, note: "Card, UPI, net banking or wallet via Razorpay. Your order is confirmed once the payment is verified." },
    { value: "COD", label: "Cash on delivery", icon: BanknotesIcon, note: "Pay when your order arrives. Your order is placed with a Pending status." },
];

const options = computed(() => ALL.filter((option) => props.methods.includes(option.value)));

const subtitle = computed(() => (props.methods.includes("RAZORPAY") ? "Choose how you'd like to pay." : "Online payment is not available right now."));
</script>
