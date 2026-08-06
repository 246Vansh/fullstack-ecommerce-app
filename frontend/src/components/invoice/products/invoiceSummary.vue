<template>

    <section
        class="grid overflow-hidden rounded-b-2xl bg-white shadow-sm lg:grid-cols-[460px_minmax(0,1fr)]">

        <!-- Help -->

        <div class="bg-gradient-to-r from-green-50/70 to-white p-8">

            <div class="flex gap-5">

                <div class="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">

                    <HeadsetIcon class="h-7 w-7 text-green-600" />

                </div>

                <div>

                    <h3 class="text-2xl font-bold text-green-700">

                        Need Help?

                    </h3>

                    <p class="mt-3 max-w-sm leading-7 text-slate-600">

                        If you have any questions about this invoice,

                        please contact our support team.

                    </p>

                    <p class="mt-5 font-semibold text-green-700">

                        {{ company.email }}

                    </p>

                </div>

            </div>

        </div>

        <!-- Totals -->

        <div class="px-10 py-8">

            <div class="space-y-4">

                <div class="flex justify-between">

                    <span>

                        Subtotal

                    </span>

                    <span>

                        ${{ invoice.subtotal.toFixed(2) }}

                    </span>

                </div>

                <div class="flex justify-between">

                    <span>

                        Shipping

                    </span>

                    <span class="font-semibold text-green-600">

                        FREE

                    </span>

                </div>

                <div class="flex justify-between">

                    <span>

                        Tax (5%)

                    </span>

                    <span>

                        ${{ invoice.tax.toFixed(2) }}

                    </span>

                </div>

                <div class="flex justify-between">

                    <span>

                        Discount

                    </span>

                    <span class="font-semibold text-green-600">

                        -${{ invoice.discount.toFixed(2) }}

                    </span>

                </div>

            </div>

            <div class="mt-6 flex items-center justify-between border-t border-gray-200 pt-6">

                <h2 class="text-2xl font-bold">

                    Grand Total

                </h2>

                <h2 class="text-4xl font-extrabold text-green-600">

                    ${{ invoice.grandTotal.toFixed(2) }}

                </h2>

            </div>

        </div>

    </section>

</template>

<script setup>

import {PhoneIcon, ChatBubbleLeftRightIcon} from "@heroicons/vue/24/outline";

defineProps({

    company: Object,

    invoice: Object,

});

</script>