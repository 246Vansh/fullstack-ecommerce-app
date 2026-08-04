<template>
    <aside class="relative hidden overflow-hidden bg-gray-900 lg:flex lg:flex-col">

        <!-- Background Image -->
        <img :src="image" :alt="title" class="absolute inset-0 h-full w-full object-cover" />

        <!-- Overlay -->
        <div class="absolute inset-0 bg-linear-to-br from-black/70 via-black/55 to-black/70" />

        <!-- Content -->
        <div class="relative z-10 flex h-full flex-col justify-between p-12">

            <!-- Top -->

            <div>

                <span
                    class="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md">
                    {{ badge }}
                </span>

            </div>

            <!-- Bottom -->

            <div class="max-w-md">

                <h1 class="text-4xl font-bold leading-tight text-white">
                    {{ title }}
                </h1>

                <p class="mt-6 text-lg leading-8 text-gray-200">
                    {{ description }}
                </p>

            </div>

        </div>

    </aside>
</template>

<script setup>
defineProps({

    badge: {
        type: String,
        default: "Premium Shopping",
    },

    title: {
        type: String,
        default: "Welcome Back",
    },

    description: {
        type: String,
        default: "Sign in to continue your premium shopping experience.",
    },

    image: {
        type: String,
        default:
            "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80",
    },

});
</script>