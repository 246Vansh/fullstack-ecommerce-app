<template>
    <section class="relative overflow-hidden border border-gray-200 bg-white">

        <!-- Soft Background Glow -->
        <div
            class="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(99,102,241,0.18),transparent_52%),radial-gradient(circle_at_10%_5%,rgba(59,130,246,0.08),transparent_40%),linear-gradient(135deg,#ffffff_0%,#fafbff_55%,#f4f7ff_100%)]">
        </div>

        <div class="relative mx-auto flex min-h-70 max-w-360 items-center justify-between px-2 py-8 lg:px-10">

            <!-- Left Content -->
            <div class="z-10 max-w-190">

                <h1 class="text-3xl font-extrabold leading-none tracking-tight text-slate-900">
                    Shopping Cart
                </h1>

                <p class="mt-4 text-[22px] leading-7 text-slate-600">
                    Review your selected items before proceeding to secure checkout.
                </p>

                <!-- Features -->
                <div class="mt-4 flex flex-wrap gap-3">

                    <!-- Item Count -->
                    <div class="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-3">

                        <ShoppingBagIcon class="h-5 w-5 text-violet-600" />

                        <span class="text-[17px] font-semibold text-slate-800">
                            {{ itemCount }} Items
                        </span>

                    </div>

                    <!-- Feature Pills -->
                    <div v-for="feature in features" :key="feature.title"
                        class="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-3 transition hover:border-violet-300 hover:shadow-sm">

                        <component :is="feature.icon" class="h-5 w-5" :class="feature.color" />

                        <span class="text-[17px] font-medium text-slate-700">
                            {{ feature.title }}
                        </span>

                    </div>

                </div>

            </div>

            <!-- Desktop Illustration -->
            <div class="pointer-events-none absolute right-1 hidden lg:block">

                <img src="@/assets/images/cart/cart-hero.png" alt="Shopping Cart" class="w-67 xl:w-140"
                    draggable="false" />

            </div>

        </div>

        <!-- Mobile -->
        <div class="flex justify-center px-6 pb-6 lg:hidden">

            <img src="@/assets/images/cart/cart-hero.png" alt="Shopping Cart" class="w-55" draggable="false" />

        </div>

    </section>
</template>

<script setup>
import {
    ArrowPathRoundedSquareIcon,
    ShieldCheckIcon,
    ShoppingBagIcon,
    TruckIcon,
} from "@heroicons/vue/24/outline";

defineProps({
    itemCount: {
        type: Number,
        default: 0,
    },
});

const features = [
    {
        title: "Secure Checkout",
        icon: ShieldCheckIcon,
        color: "text-violet-600",
    },
    {
        title: "Fast Delivery",
        icon: TruckIcon,
        color: "text-emerald-600",
    },
    {
        title: "30-Day Returns",
        icon: ArrowPathRoundedSquareIcon,
        color: "text-green-600",
    },
];
</script>