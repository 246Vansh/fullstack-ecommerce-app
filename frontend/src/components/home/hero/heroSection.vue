<template>
    <section class="relative overflow-hidden bg-white">
        <div class="pt-16 pb-80 sm:pt-24 sm:pb-40 lg:pt-40 lg:pb-48">

            <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

                <!-- Left Content -->
                <div class="max-w-xl">

                    <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                        Summer styles are finally here
                    </h1>

                    <p class="mt-6 text-lg leading-8 text-gray-600">
                        This year, our new summer collection will shelter you from the
                        harsh elements of a world that doesn't care if you live or die.
                    </p>

                    <div class="mt-10">

                        <PrimaryButton href="#" variant="primary">
                            Shop Collection
                        </PrimaryButton>

                    </div>

                </div>

                <!-- Hero Images -->
                <div class="mt-16 lg:mt-0">

                    <div aria-hidden="true"
                        class="pointer-events-none lg:absolute lg:inset-y-0 lg:mx-auto lg:w-full lg:max-w-7xl">

                        <div
                            class="absolute transform sm:top-0 sm:left-1/2 sm:translate-x-8 lg:top-1/2 lg:left-1/2 lg:-translate-y-1/2 lg:translate-x-8">

                            <div class="flex items-center space-x-6 lg:space-x-8">

                                <!-- Image Columns -->
                                <div v-for="(column, index) in heroColumns" :key="index"
                                    class="grid shrink-0 grid-cols-1 gap-y-6 lg:gap-y-8">

                                    <HeroImage v-for="image in column" :key="image.id" :image="image" />

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </div>

        </div>
    </section>
</template>

<script setup>
import HeroImage from "./heroImage.vue";
import { heroColumns } from "@/constants/heroImages";
import PrimaryButton from "@/components/ui/primaryButton.vue";
</script>