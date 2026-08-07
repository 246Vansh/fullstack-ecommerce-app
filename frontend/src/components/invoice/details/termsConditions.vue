<template>

    <section
        class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.05)]">

        <div class="grid lg:grid-cols-[1fr_230px]">

            <!-- LEFT -->

            <div class="px-10 py-8">

                <!-- Heading -->

                <div class="flex items-center gap-6">

                    <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-orange-50">

                        <DocumentTextIcon class="h-8 w-8 text-orange-600" />

                    </div>

                    <h2 class="text-[18px] font-extrabold uppercase tracking-[0.06em] text-slate-900">
                        TERMS & CONDITIONS
                    </h2>

                </div>

                <!-- Description -->

                <div class=" max-w-[560px] space-y-3">

                    <p class="text-[18px] leading-[1.9] text-slate-600">

                        This invoice is computer generated and
                        does not require a physical signature.

                    </p>

                    <p class="text-[18px] leading-[1.9] text-slate-600">
                        All sales are final.
                    </p>

                </div>

                <!-- Thank You -->

                <div class="flex items-start gap-5">

                    <HeartIcon class="mt-1 h-9 w-9 shrink-0 fill-rose-500 text-rose-500" />

                    <div>

                        <p class="text-[18px] leading-9 text-slate-700">
                            Thank you for choosing Shopi.
                        </p>

                        <p class="text-[18px] leading-9 text-slate-700">
                            We appreciate your business!
                        </p>

                    </div>

                </div>

            </div>

            <!-- RIGHT -->

            <div class="flex flex-col items-center justify-center px-6 py-8">

                <!-- QR -->

                <div class="rounded-3xl border border-orange-200 bg-white p-3 shadow-[0_8px_20px_rgba(251,146,60,.12)]">

                    <img src="@/assets/images/invoice/qr-code.png" alt="QR Code"
                        class="h-[135px] w-[135px] object-contain">

                </div>

                <p class="mt-5 text-center text-[18px] leading-8 text-slate-700">
                    Scan to view
                    <br>
                    your order
                </p>

            </div>

        </div>

    </section>

</template>

<script setup>

import {DocumentTextIcon,HeartIcon} from "@heroicons/vue/24/solid";

</script>