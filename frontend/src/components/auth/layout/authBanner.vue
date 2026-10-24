<template>

    <!-- Desktop only. A forest-green brand panel; a photo is drawn over it only
         when a screen passes one (none do). The text is supporting copy, not a
         heading: the form's <h1> names the page. -->
    <aside
        class="relative hidden overflow-hidden bg-linear-to-br from-brand to-brand-hover text-white lg:flex lg:flex-col">

        <template v-if="image">
            <img :src="image" alt="" class="absolute inset-0 h-full w-full object-cover" />
            <div class="absolute inset-0 bg-brand-hover/80" aria-hidden="true" />
        </template>

        <!-- Soft light in one corner, so the panel is not a flat block. -->
        <div aria-hidden="true"
            class="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"></div>

        <div class="relative z-10 flex h-full flex-col justify-between gap-12 p-12 xl:p-14">

            <div>
                <span
                    class="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/90 ring-1 ring-white/20 ring-inset">
                    {{ badge }}
                </span>
            </div>

            <div class="max-w-sm">
                <p class="text-3xl leading-tight font-semibold tracking-tight text-balance text-white">
                    {{ title }}
                </p>

                <p class="mt-4 text-base leading-7 text-pretty text-white/80">
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
        default: "",
    },

    title: {
        type: String,
        default: "",
    },

    description: {
        type: String,
        default: "",
    },

    // Optional photo behind the green panel; none of the auth screens set one.
    image: {
        type: String,
        default: "",
    },

});
</script>
