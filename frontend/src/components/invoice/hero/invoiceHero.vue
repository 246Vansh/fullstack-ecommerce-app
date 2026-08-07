<template>

    <section class="relative overflow-hidden rounded-2xl bg-white shadow-sm">

        <!-- Background -->

        <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(99,102,241,0.06),transparent_28%),radial-gradient(circle_at_18%_80%,rgba(59,130,246,0.04),transparent_32%),linear-gradient(180deg,#ffffff_0%,#fcfdff_100%)]">
        </div>

        <div class="relative grid min-h-[240px] lg:grid-cols-[290px_minmax(0,1fr)]">

            <!-- LEFT PANEL -->
            <aside class=" bg-indigo-100 px-7 py-7">

                <!-- Logo -->

                <div>
                    <img src="@/assets/images/invoice/logo.png" class="h-18">
                </div>  

                <!-- Company -->

                <div class="mt-8">

                    <h2 class="text-[26px] font-bold tracking-tight text-slate-900">
                        {{ company.name }}
                    </h2>

                    <div class="mt-5 space-y-1 text-[16px] font-semibold leading-8 text-black">

                        <p>
                            {{ company.address }}
                        </p>

                        <p>
                            {{ company.city }},{{ company.state }},{{ company.country }}
                        </p>
                    </div>

                </div>

                <!-- Contact -->

                <div class="mt-8 space-y-5">

                    <div class="flex items-center gap-4">

                        <EnvelopeIcon class="h-5 w-5 text-blue-600" />

                        <span class="text-[16px] font-semibold">
                            {{ company.email }}
                        </span>

                    </div>

                    <div class="flex items-center gap-4">

                        <PhoneIcon class="h-5 w-5 text-blue-600" />

                        <span class="text-[16px] font-semibold">
                            {{ company.phone }}
                        </span>

                    </div>

                    <div class="flex items-center gap-4">

                        <GlobeAltIcon class="h-5 w-5 text-blue-600" />

                        <span class="text-[16px] font-semibold">
                            {{ company.website }}
                        </span>

                    </div>

                </div>

                <!-- Social -->

                <div class="mt-8 flex gap-3">

                    <button v-for="item in socials" :key="item.icon"
                        class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 transition hover:bg-blue-100 cursor-pointer">

                        <component :is="item.icon" class="h-5 w-5 text-slate-700" />

                    </button>

                </div>

            </aside>

            <!-- RIGHT -->

            <section class="grid items-center lg:grid-cols-[1fr_440px]">

                <!-- CENTER -->

                <div class="px-14 py-10 text-center">

                    <!-- Badge -->

                    <span
                        class="inline-flex rounded-xl border border-violet-200 bg-violet-50 px-6 py-2 text-m font-bold uppercase tracking-[0.25em] text-violet-700 shadow-sm">
                        Invoice
                    </span>

                    <!-- Number -->

                    <h1 class="mt-7 text-[68px] font-black leading-none tracking-[-0.05em] text-slate-900">
                        {{ invoice.invoiceNumber }}
                    </h1>

                    <!-- Paid -->

                    <div class="mt-7">

                        <span
                            class="inline-flex items-center gap-3 rounded-2xl bg-blue-100 px-7 py-3">

                            <CheckCircleIcon class="h-7 w-7 text-blue-600" />

                            <span class="text-xl font-bold text-blue-700">
                                PAID
                            </span>

                        </span>

                    </div>

                    <!-- Subtitle -->

                    <p class="mt-8 text-xl font-semibold text-slate-600">
                        Thank you for shopping with Shopi.
                    </p>

                    <!-- Buttons -->

                    <div class="mt-10 flex justify-center gap-5">

                        <button
                            class="flex h-14 items-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 cursor-pointer">

                            <ArrowDownTrayIcon class="h-5 w-5" />

                            Download PDF

                        </button>

                        <button
                            class="flex h-14 items-center gap-3 rounded-xl border border-slate-300 bg-white px-8 text-lg font-semibold text-slate-800 transition hover:bg-slate-50 cursor-pointer">

                            <PrinterIcon class="h-5 w-5" />

                            Print Invoice

                        </button>

                    </div>

                </div>

                <!-- Illustration -->

                <div class="relative flex h-full items-center justify-center overflow-hidden">

                    <!-- Background Blob -->

                    <div class="absolute right-10 top-8 h-72 w-72 rounded-full bg-violet-100 opacity-80 blur-2xl">
                    </div>

                    <div class="absolute bottom-10 left-10 h-44 w-44 rounded-full bg-blue-100 opacity-80 blur-xl">
                    </div>

                    <!-- Floating Status Card -->

                    <div
                        class="absolute left-0 top-10 z-20 rotate-[-8deg] rounded-2xl border border-slate-100 bg-white px-5 py-3 shadow-xl">

                        <div class="flex items-center gap-3">

                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">

                                <CheckCircleIcon class="h-5 w-5 text-green-600" />

                            </div>

                            <div>

                                <p class="text-sm font-semibold text-slate-800">

                                    Payment Complete

                                </p>

                                <p class="text-xs text-slate-500">

                                    Secure Transaction

                                </p>

                            </div>

                        </div>

                    </div>

                    <!-- Hero Image -->

                    <img src="@/assets/images/invoice/invoice-hero.png" alt="Invoice Illustration"
                        class="relative z-10 w-[440px] max-w-none object-contain drop-shadow-[0_30px_60px_rgba(37,99,235,0.18)]" />
                </div>

            </section>

        </div>

    </section>

</template>

<script setup>

import {

    EnvelopeIcon,
    PhoneIcon,
    GlobeAltIcon,
    ArrowDownTrayIcon,
    PrinterIcon,
    CheckCircleIcon,

} from "@heroicons/vue/24/outline";

import {

    Facebook,
    Instagram,
    Twitter,
    Linkedin,

} from "lucide-vue-next";

const socials = [

    { icon: Facebook },
    { icon: Instagram },
    { icon: Twitter },
    { icon: Linkedin },

];

defineProps({

    company: Object,
    invoice: Object,

});

</script>