<template>

    <main id="main-content" tabindex="-1" class="min-h-screen bg-surface">

        <!-- Phones: the card starts near the top, so the form is in view at once.
             From sm it is centred in the window. -->
        <section class="mx-auto flex min-h-screen max-w-6xl items-start px-4 py-6 sm:items-center sm:px-6 sm:py-10 lg:px-8">

            <div class="grid w-full overflow-hidden rounded-panel border border-slate-200/80 bg-white shadow-raised lg:grid-cols-2">

                <authBanner :badge="banner.badge" :title="banner.title" :description="banner.description"
                    :image="banner.image" />

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

defineProps({
    banner: {
        type: Object,
        required: true,
    },
});
</script>
