<template>

    <section class="rounded-2xl bg-white p-8 shadow-sm">

        <div class="flex items-start gap-5">

            <div class="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">

                <UserIcon class="h-8 w-8 text-orange-700" />

            </div>
            <div>
                <div>

                    <p class="text-sm font-bold uppercase tracking-wide text-black">

                        Bill To

                    </p>

                    <h3 class="mt-2 text-2xl font-bold text-slate-900">

                        {{ billing.name }}

                    </h3>

                </div>
                <div class="mt-2 space-y-1 text-lg font-semibold text-slate-700">

                    <p>{{ billing.email }}</p>

                    <p>{{ billing.phone }}</p>

                    <p>{{ billing.address }}</p>

                    <p>{{ billing.city }}, {{ billing.state }} {{ billing.zip }}, {{ billing.country }}</p>
                </div>
            </div>
        </div>

    </section>

</template>

<script setup>

import { UserIcon } from "@heroicons/vue/24/outline";

defineProps({

    billing: Object,

});

</script>