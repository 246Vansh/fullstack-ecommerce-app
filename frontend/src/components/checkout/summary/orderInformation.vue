<template>

    <section class="space-y-5 border-b border-gray-100 px-8 py-7">

        <!-- Customer -->

        <div class="flex items-start justify-between">

            <div>

                <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Customer
                </p>

                <h3 class="mt-1 font-semibold text-slate-900">
                    {{ customerName }}
                </h3>

                <p class="text-sm text-slate-500">
                    {{ customer?.email }}
                </p>

            </div>

        </div>

        <!-- Address -->

        <div>

            <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Shipping Address
            </p>

            <p v-if="address" class="mt-2 text-sm leading-6 text-slate-600">
                {{ address.firstName }} {{ address.lastName }},
                {{ [address.address, address.apartment].filter(Boolean).join(", ") }},
                {{ address.city }}, {{ address.state }} {{ address.zipCode }}
            </p>

            <p v-else class="mt-2 text-sm font-medium text-amber-600">
                No shipping address selected
            </p>

        </div>

        <!-- Delivery -->

        <div class="flex items-center justify-between">

            <div>

                <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Delivery
                </p>

                <p class="mt-1 font-medium text-slate-700">
                    Express Shipping
                </p>

            </div>

            <span class="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-600">
                Tomorrow
            </span>

        </div>

        <!-- Payment -->

        <div class="flex items-center justify-between">

            <div>

                <p class="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Payment
                </p>

                <p class="mt-1 font-medium text-slate-700">
                    Visa •••• 4832
                </p>

            </div>

            <img src="@/assets/payment/visa-logo.png" class="h-8 object-contain">

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
