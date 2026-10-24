<template>
    <section aria-labelledby="hero-heading" class="bg-white">
        <div
            class="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-8 pb-14 sm:px-6 sm:pt-12 sm:pb-16 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:pt-16 lg:pb-16">

            <!-- Copy -->
            <div class="lg:col-span-5">
                <p class="text-sm font-medium tracking-wide text-brand">
                    Women &middot; Men &middot; Shoes &middot; Accessories
                </p>

                <h1 id="hero-heading"
                    class="mt-4 text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-5xl lg:text-6xl">
                    Wardrobe staples, all in one place
                </h1>

                <p class="mt-6 max-w-lg text-lg leading-8 text-pretty text-slate-600">
                    Shop clothing, shoes and accessories for women and men. Filter by brand,
                    size, colour and price, then check out in a few steps.
                </p>

                <div class="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                    <PrimaryButton to="/products" size="lg">
                        Shop all products
                    </PrimaryButton>

                    <div class="flex items-center gap-6">
                        <RouterLink v-for="link in SHOP_LINKS" :key="link.label" :to="link.to"
                            class="group inline-flex min-h-11 items-center gap-1 rounded-sm text-sm font-semibold text-slate-900 transition-colors hover:text-brand outline-brand focus-visible:outline-2 focus-visible:outline-offset-2">
                            {{ link.label }}
                            <span aria-hidden="true"
                                class="transition-transform motion-safe:group-hover:translate-x-0.5">&rarr;</span>
                        </RouterLink>
                    </div>
                </div>
            </div>

            <!-- Photos: a row of three on small screens, one tall and two square beside it from lg. -->
            <div class="lg:col-span-7" aria-hidden="true">
                <div class="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-2 lg:grid-rows-2">
                    <HeroImage v-for="(image, index) in heroImages" :key="image.id" :src="image.src"
                        :priority="index === 0" :sizes="index === 0 ? LARGE_SIZES : SMALL_SIZES"
                        :class="index === 0 ? 'aspect-3/4 lg:row-span-2 lg:aspect-auto' : 'aspect-3/4 lg:aspect-square'" />
                </div>
            </div>

        </div>
    </section>
</template>

<script setup>
import { RouterLink } from "vue-router";

import HeroImage from "./heroImage.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import { heroImages } from "@/constants/heroImages";

// Category slugs seeded in the database (see constants/navigation.js).
const SHOP_LINKS = [
    { label: "Shop women", to: { name: "products", query: { category: "women" } } },
    { label: "Shop men", to: { name: "products", query: { category: "men" } } },
];

// A tile is ~30vw wide below lg; from lg the tall tile is ~330x680px and the
// squares ~330px. object-cover paints a 3:2 photo ~1.5x the tile height wide.
const LARGE_SIZES = "(min-width: 1024px) 1020px, 60vw";
const SMALL_SIZES = "(min-width: 1024px) 500px, 60vw";
</script>
