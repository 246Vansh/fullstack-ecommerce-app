<template>

    <aside class="sticky top-8 overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm">

        <!-- Header -->

        <div class="border-b border-gray-100 px-8 py-7">

            <div class="flex items-center gap-4">

                <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100">

                    <ClipboardDocumentListIcon class="h-7 w-7 text-indigo-600" />

                </div>

                <div>

                    <h2 class="text-2xl font-bold">

                        Order Summary

                    </h2>

                    <p class="text-slate-500">

                        Review your purchase.

                    </p>

                </div>

            </div>

        </div>

        <orderInformation />

        <orderItems :products="products" />

        <orderTotals :subtotal="subtotal" :discount="discount" :shipping="shipping" :tax="tax" :total="total" />

        <checkoutButton />

        <securityBenefits />

    </aside>

</template>

<script setup>
import { ClipboardDocumentListIcon } from "@heroicons/vue/24/outline";

import orderInformation from "./orderInformation.vue";
import orderItems from "./orderItems.vue";
import orderTotals from "./orderTotals.vue";
import checkoutButton from "./checkoutButton.vue";
import securityBenefits from "./securityBenefits.vue";

defineProps({

    products: Array,

    subtotal: Number,

    discount: Number,

    shipping: Number,

    tax: Number,

    total: Number,

});
</script>