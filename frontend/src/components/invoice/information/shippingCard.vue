<template>

    <section class="rounded-2xl bg-white p-8 shadow-sm">

        <div class="flex items-start gap-5">

            <div class="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">

                <TruckIcon class="h-8 w-8 text-emerald-800" />

            </div>

            <div>
                <div>

                    <p class="text-sm font-bold uppercase tracking-wide text-black">
                        Ship To
                    </p>

                    <h3 class="mt-2 text-2xl font-bold text-slate-900">
                        {{ shipping.receiver }}
                    </h3>

                </div>

                <div class="mt-2 space-y-1 text-lg font-semibold text-slate-700">

                    <p>{{ shipping.phone }}</p>

                    <p>{{ shipping.address }}</p>

                    <p>{{ shipping.city }}, {{ shipping.state }} {{ shipping.zip }}, {{ shipping.country }}</p>

                </div>
            </div>

        </div>

    </section>

</template>

<script setup>

import { TruckIcon } from "@heroicons/vue/24/outline";

defineProps({

    shipping: Object,

});

</script>