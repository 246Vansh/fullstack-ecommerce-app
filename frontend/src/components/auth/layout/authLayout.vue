<template>
    <main class="min-h-screen bg-gray-50">

        <section class=" mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">

            <div class=" grid w-full overflow-hidden rounded-3xl bg-white shadow-xl lg:grid-cols-2">

                <!-- Left Panel -->
                <authBanner :badge="banner.badge" :title="banner.title" :description="banner.description"
                    :image="banner.image" />

                <!-- Right Panel -->
                <authWrapper>

                    <slot />

                </authWrapper>

            </div>

        </section>

    </main>
</template>

<script setup>
import authBanner from "./authBanner.vue";
import authWrapper from "./authWrapper.vue";

const props = defineProps({

    banner: {
        type: Object,
        required: true,
    },

});
</script>