<template>

    <section class="rounded-panel border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="order-shipping-heading">

        <h2 id="order-shipping-heading" class="text-base font-semibold text-slate-900">
            Shipping address
        </h2>

        <!-- The address snapshot stored on the order; empty fields are skipped, never filled in. -->
        <address class="mt-4 flex gap-3 text-sm leading-6 text-slate-600 not-italic">
            <MapPinIcon class="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <div class="min-w-0 wrap-anywhere">
                <p v-if="name" class="font-semibold text-slate-900">{{ name }}</p>
                <p v-for="(line, index) in lines" :key="index">{{ line }}</p>
            </div>
        </address>

        <dl v-if="address.phone || email" class="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
            <div v-if="address.phone" class="flex items-center gap-3">
                <dt class="shrink-0"><PhoneIcon class="h-5 w-5 text-slate-400" aria-hidden="true" /><span class="sr-only">Phone</span></dt>
                <dd class="min-w-0 wrap-anywhere text-slate-700">{{ address.phone }}</dd>
            </div>
            <div v-if="email" class="flex items-center gap-3">
                <dt class="shrink-0"><EnvelopeIcon class="h-5 w-5 text-slate-400" aria-hidden="true" /><span class="sr-only">Email</span></dt>
                <dd class="min-w-0 wrap-anywhere text-slate-700">{{ email }}</dd>
            </div>
        </dl>

    </section>

</template>

<script setup>
import { computed } from "vue";
import { EnvelopeIcon, MapPinIcon, PhoneIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
    address: {
        type: Object,
        required: true,
    },
    // The email captured when the order was placed (optional).
    email: {
        type: String,
        default: "",
    },
});

const join = (parts, separator) => parts.filter(Boolean).join(separator);

const name = computed(() => join([props.address.firstName, props.address.lastName], " "));

const lines = computed(() => [
    join([props.address.address, props.address.apartment], ", "),
    join([join([props.address.city, props.address.state], ", "), props.address.zipCode], " "),
    props.address.country,
].filter(Boolean));
</script>
