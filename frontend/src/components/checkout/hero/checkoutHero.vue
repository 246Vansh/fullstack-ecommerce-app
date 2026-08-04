<template>

    <section class="relative overflow-hidden bg-white px-10 py-10">

        <!-- Background -->

        <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(99,102,241,0.08),transparent_35%),radial-gradient(circle_at_82%_22%,rgba(139,92,246,0.10),transparent_35%),linear-gradient(to_bottom,#ffffff,#fafbff)]">
        </div>

        <div class="relative grid items-center lg:grid-cols-[1fr_320px]">

            <!-- Left -->

            <div>

                <h1 class="text-5xl font-bold text-slate-900">
                    Secure Checkout
                </h1>

                <div class="mt-5 flex items-center gap-3">

                    <div class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">

                        <ShieldCheckIcon class="h-4 w-4 text-indigo-600" />

                    </div>

                    <p class="text-lg text-slate-600">

                        You're one step away from your new products

                    </p>

                </div>

                <div class="mt-10">

                    <checkoutProgress current-step="checkout" />

                </div>

            </div>

            <!-- Right -->

            <div class="flex justify-center">

                <img src="@/assets/images/checkout/secure-checkout.png" class="w-63 object-contain">

            </div>

        </div>

    </section>

</template>

<script setup>
import { ShieldCheckIcon } from "@heroicons/vue/24/outline";
import checkoutProgress from "../progress/checkoutProgress.vue";
</script>