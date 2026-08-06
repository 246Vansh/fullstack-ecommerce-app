<template>

    <section class="rounded-2xl bg-white p-8 shadow-sm">

        <div class="flex items-start gap-5">

            <div class="flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">

                <BuildingStorefrontIcon class="h-8 w-8 text-purple-700" />

            </div>

            <div>

                <div>

                    <p class="text-sm font-bold uppercase tracking-wide text-black">
                        From
                    </p>

                    <h3 class="mt-2 text-2xl font-bold text-slate-900">
                        {{ company.name }}
                    </h3>

                </div>
                <div class="mt-2 space-y-1 text-lg font-semibold text-slate-700">

                    <p>{{ company.address }}</p>

                    <p>{{ company.city }}, {{ company.state }} {{ company.zip }}, {{ company.country }}</p>

                    <p>{{ company.email }}</p>

                    <p>{{ company.phone }}</p>

                </div>
            </div>
        </div>



    </section>

</template>

<script setup>

import { BuildingStorefrontIcon } from "@heroicons/vue/24/outline";

defineProps({

    company: Object,

});

</script>