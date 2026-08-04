<template>
    <section aria-labelledby="cause-heading">
        <div class="mx-auto max-w-9xl px-4 sm:px-6 lg:px-8">

            <div class="relative overflow-hidden rounded-2xl">

                <!-- Background -->
                <div class="absolute inset-0">
                    <img src="https://tailwindcss.com/plus-assets/img/ecommerce-images/home-page-03-feature-section-full-width.jpg"
                        alt="Long-term thinking" class="h-full w-full object-cover object-center" />
                </div>

                <!-- Overlay -->
                <div class="absolute inset-0 bg-gray-900/50" aria-hidden="true"></div>

                <!-- Content -->
                <div
                    class="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-32 text-center sm:px-12 sm:py-40">
                    <h2 id="cause-heading" class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        Long-term thinking
                    </h2>

                    <p class="mt-4 text-xl leading-8 text-white">
                        We're committed to responsible, sustainable, and ethical
                        manufacturing. Our small-scale approach allows us to focus on
                        quality and reduce our impact. We're doing our best to delay the
                        inevitable heat-death of the universe.
                    </p>

                    <PrimaryButton href="#" variant="light" class="mt-8">
                        Read our story
                    </PrimaryButton>

                </div>

            </div>

        </div>
    </section>
</template>

<script setup>
import PrimaryButton from "@/components/ui/PrimaryButton.vue";
</script>