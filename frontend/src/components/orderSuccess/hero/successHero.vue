<template>

    <section
        class="relative overflow-hidden rounded-xl bg-white shadow-[0_12px_40px_rgba(15,23,42,.05)]">

        <!-- Background -->

        <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(34,197,94,0.06),transparent_35%),radial-gradient(circle_at_82%_20%,rgba(59,130,246,0.05),transparent_40%),linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)]">
        </div>

        <div class="relative">

            <!-- Hero -->

            <div class="grid items-center gap-8 px-5 pt-8 pb-6 sm:px-8 lg:gap-10 lg:px-14 lg:pt-10 lg:pb-8 lg:grid-cols-[minmax(0,1fr)_560px]">

                <!-- LEFT -->

                <div class="flex flex-col items-center gap-8 text-center sm:flex-row sm:gap-12 sm:text-left lg:flex-col lg:text-center xl:flex-row xl:gap-20 xl:text-left">

                    <!-- Success Icon -->

                    <div class="relative shrink-0 xl:-translate-y-16">

                        <!-- Glow -->

                        <div class="absolute inset-0 rounded-full bg-green-300/30 blur-3xl">
                        </div>

                        <!-- Circle -->

                        <div
                            class="relative flex h-28 w-28 items-center sm:h-44 sm:w-44 justify-center rounded-full bg-green-600 shadow-[0_20px_60px_rgba(34,197,94,.35)]">

                            <CheckIcon class="h-16 w-16 stroke-[3] text-white sm:h-24 sm:w-24" />

                        </div>

                        <!-- Confetti -->

                        <span class="absolute -left-6 top-8 h-3 w-3 rotate-45 bg-sky-500"></span>
                        <span class="absolute -left-4 bottom-10 h-3 w-8 -rotate-45 rounded-full bg-blue-500"></span>
                        <span class="absolute -right-5 top-3 h-3 w-6 rotate-45 bg-violet-500"></span>
                        <span class="absolute right-2 -bottom-5 h-3 w-8 rotate-45 bg-green-500"></span>
                        <span class="absolute -left-6 top-24 h-3 w-3 rounded-full bg-yellow-400"></span>
                        <span class="absolute right-0 top-28 h-3 w-3 rotate-45 bg-orange-400"></span>
                        <span class="absolute left-8 -top-5 h-2 w-2 rounded-full bg-blue-400"></span>
                        <span class="absolute right-10 -top-4 h-2 w-6 rotate-45 bg-green-500"></span>

                    </div>

                    <!-- Content -->

                    <div class="min-w-0">

                        <h1 class="max-w-[640px] text-3xl font-extrabold sm:text-4xl leading-[1.12] tracking-tight text-slate-900">

                            Your order has been

                            <span class="block text-green-600">

                                placed successfully!

                            </span>

                        </h1>

                        <p class="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">

                            Thank you for shopping with us.

                            We've received your order. Its status is Pending and no
                            payment has been taken yet.

                        </p>

                        <!-- Order Card -->

                        <div
                            class="mt-8 inline-flex max-w-full overflow-hidden lg:translate-x-4 rounded-2xl border border-gray-200 bg-white shadow-md">

                            <div class="flex min-w-0 items-center px-5 py-4 sm:px-8">

                                <span class="wrap-anywhere text-lg font-bold text-green-600 sm:text-xl">

                                    Order #{{ order.orderNumber }}

                                </span>

                            </div>

                            <button type="button" :title="copied ? 'Copied' : 'Copy order number'"
                                class="flex shrink-0 items-center justify-center border-l border-gray-200 px-5 transition sm:px-6 hover:bg-slate-50 cursor-pointer"
                                @click="copyOrderNumber">

                                <CheckIcon v-if="copied" class="h-6 w-6 text-green-600" />
                                <DocumentDuplicateIcon v-else class="h-6 w-6 text-slate-500" />

                            </button>

                        </div>

                    </div>

                </div>

                <!-- RIGHT -->

                <div class="relative flex justify-center lg:translate-x-6 lg:translate-y-3">

                    <!-- Glow -->

                    <div class="absolute h-[280px] w-[280px] rounded-full sm:h-[420px] sm:w-[420px] bg-green-100/40 blur-[120px]">
                    </div>

                    <!-- Illustration -->

                    <img src="@/assets/images/orderSuccess/order-success.png" alt="Order Success"
                        class="relative z-10 w-[560px] max-w-full object-contain" />

                </div>

            </div>

            <!-- Overview Cards -->

            <div class="px-5 pb-8 sm:px-8 lg:px-14 lg:pb-10">

                <successOverviewCards :order="order" :product-count="productCount" :total-quantity="totalQuantity" />

            </div>

        </div>

    </section>

</template>

<script setup>
import { ref } from "vue";
import {
    CheckIcon,
    DocumentDuplicateIcon,
} from "@heroicons/vue/24/outline";

import successOverviewCards from "../overview/successOverviewCards.vue";

const props = defineProps({

    order: {
        type: Object,
        required: true,
    },

    productCount: Number,

    totalQuantity: Number,

});

const copied = ref(false);

async function copyOrderNumber() {
    try {
        await navigator.clipboard.writeText(props.order.orderNumber);
        copied.value = true;
        setTimeout(() => { copied.value = false; }, 2000);
    } catch {
        // Clipboard unavailable (permissions / insecure context): nothing to do.
    }
}
</script>