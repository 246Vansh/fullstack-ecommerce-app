<template>

    <section class="rounded-2xl bg-white shadow-sm">

        <div class="grid lg:grid-cols-4">

            <!-- Invoice Date -->

            <div
                class="relative flex items-center gap-5 px-8 py-7 after:absolute after:right-0 after:top-1/2 after:h-14 after:w-[3px] after:-translate-y-1/2 after:bg-gray-200">

                <div class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">

                    <CalendarDaysIcon class="h-7 w-7 text-indigo-700" />

                </div>

                <div>

                    <p class="text-sm font-bold text-black">
                        Invoice Date
                    </p>

                    <h3 class="mt-1 font-semibold">
                        {{ invoice.invoiceDate }}
                    </h3>

                </div>

            </div>

            <!-- Payment Date -->

            <div class="relative flex items-center gap-5 px-8 py-7 after:absolute after:right-0 after:top-1/2 after:h-14 after:w-[3px] after:-translate-y-1/2 after:bg-gray-200">

                <div class="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">

                    <CreditCardIcon class="h-7 w-7 text-purple-700" />

                </div>

                <div>

                    <p class="text-sm font-bold text-black">
                        Payment Date
                    </p>

                    <h3 class="mt-1 font-semibold">
                        {{ invoice.paymentDate }}
                    </h3>

                </div>

            </div>

            <!-- Transaction -->

            <div class="relative flex items-center gap-5 px-8 py-7 after:absolute after:right-0 after:top-1/2 after:h-14 after:w-[3px] after:-translate-y-1/2 after:bg-gray-200">

                <div class="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">

                    <HashtagIcon class="h-7 w-7 text-orange-700" />

                </div>

                <div>

                    <p class="text-sm font-bold text-black">
                        Transaction ID
                    </p>

                    <h3 class="mt-1 font-semibold">
                        {{ payment.transactionId }}
                    </h3>

                </div>

            </div>

            <!-- Order -->

            <div class="flex items-center gap-5 px-8 py-7">

                <div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">

                    <ClipboardDocumentListIcon class="h-7 w-7 text-red-700" />

                </div>

                <div>

                    <p class="text-sm font-bold text-black">
                        Order ID
                    </p>

                    <h3 class="mt-1 font-semibold">
                        {{ invoice.orderNumber }}
                    </h3>

                </div>

            </div>

        </div>

    </section>

</template>

<script setup>

import {

    CalendarDaysIcon,

    CreditCardIcon,

    HashtagIcon,

    ClipboardDocumentListIcon,

} from "@heroicons/vue/24/outline";

defineProps({

    invoice: Object,

    payment: Object,

});

</script>