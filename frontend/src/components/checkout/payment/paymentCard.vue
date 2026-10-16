<template>

    <checkoutSection number="03" title="Payment" :subtitle="subtitle" :icon="CreditCardIcon" :editable="false">

        <!-- Only the methods the server offers (online needs Razorpay keys on the server). -->
        <fieldset>
            <legend class="sr-only">Payment method</legend>

            <div class="grid gap-3">
                <label v-for="option in options" :key="option.value"
                    class="flex cursor-pointer items-start gap-3 rounded-2xl border px-5 py-4 transition"
                    :class="modelValue === option.value ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:bg-slate-50'">
                    <input type="radio" name="payment-method" class="mt-1 h-4 w-4 accent-green-600" :value="option.value"
                        :checked="modelValue === option.value" :disabled="disabled"
                        @change="$emit('update:modelValue', option.value)" />
                    <span>
                        <span class="block font-semibold text-slate-900">{{ option.label }}</span>
                        <span class="block text-sm text-slate-600">{{ option.note }}</span>
                    </span>
                </label>
            </div>
        </fieldset>

    </checkoutSection>

</template>

<script setup>
import { computed } from "vue";
import { CreditCardIcon } from "@heroicons/vue/24/outline";

import checkoutSection from "../common/checkoutSection.vue";

const props = defineProps({
    // Methods the server accepts, e.g. ["COD", "RAZORPAY"].
    methods: { type: Array, default: () => ["COD"] },
    modelValue: { type: String, default: "COD" },
    disabled: { type: Boolean, default: false },
});

defineEmits(["update:modelValue"]);

const ALL = [
    { value: "RAZORPAY", label: "Pay online", note: "Card, UPI, net banking or wallet via Razorpay. Your order is confirmed once the payment is verified." },
    { value: "COD", label: "Cash on delivery", note: "Pay when your order arrives. Your order is placed with a Pending status." },
];

const options = computed(() => ALL.filter((option) => props.methods.includes(option.value)));

const subtitle = computed(() => (props.methods.includes("RAZORPAY") ? "Choose how you'd like to pay." : "Online payment is not available right now."));
</script>
