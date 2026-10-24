<template>

    <section class="grid gap-4 px-5 py-4 text-sm sm:px-6">

        <!-- Customer -->

        <div class="min-w-0">

            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Customer
            </p>

            <p class="mt-1 font-medium text-slate-900">
                {{ customerName }}
            </p>

            <p class="break-all text-slate-600">
                {{ customer?.email }}
            </p>

        </div>

        <!-- Address -->

        <div>

            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Ship to
            </p>

            <p v-if="address" class="mt-1 leading-6 text-slate-600">
                {{ address.firstName }} {{ address.lastName }},
                {{ [address.address, address.apartment].filter(Boolean).join(", ") }},
                {{ address.city }}, {{ address.state }} {{ address.zipCode }}
            </p>

            <p v-else class="mt-1 font-medium text-amber-800">
                No shipping address selected
            </p>

        </div>

    </section>

</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
    // Signed-in user ({ firstName, lastName, email }).
    customer: {
        type: Object,
        default: null,
    },
    // Selected saved address, from GET /api/checkout.
    address: {
        type: Object,
        default: null,
    },
});

const customerName = computed(() =>
    [props.customer?.firstName, props.customer?.lastName].filter(Boolean).join(" ")
);
</script>
