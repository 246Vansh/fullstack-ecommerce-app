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

            <!-- Photos: a row of three on small screens, one tall and two square beside it from lg.
                 The tiles stay in place; every minute their photos change to the next set. -->
            <div class="lg:col-span-7" aria-hidden="true">
                <div class="grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-2 lg:grid-rows-2">
                    <HeroImage v-for="(image, index) in currentSet" :key="index" :src="image.src"
                        :priority="index === 0" :sizes="index === 0 ? LARGE_SIZES : SMALL_SIZES"
                        :class="index === 0 ? 'aspect-3/4 lg:row-span-2 lg:aspect-auto' : 'aspect-3/4 lg:aspect-square'" />
                </div>
            </div>

        </div>
    </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import HeroImage, { HERO_WIDTHS } from "./heroImage.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import { HERO_ROTATE_MS, heroImageSets } from "@/constants/heroImages";
import { sizedImage, sizedImageSrcset } from "@/utils/images";

// Category slugs seeded in the database (see constants/navigation.js).
const SHOP_LINKS = [
    { label: "Shop women", to: { name: "products", query: { category: "women" } } },
    { label: "Shop men", to: { name: "products", query: { category: "men" } } },
];

// A tile is ~30vw wide below lg; from lg the tall tile is ~330x680px and the
// squares ~330px. object-cover paints a 3:2 photo ~1.5x the tile height wide.
const LARGE_SIZES = "(min-width: 1024px) 1020px, 60vw";
const SMALL_SIZES = "(min-width: 1024px) 500px, 60vw";

// ------------------------------------------------------------ rotation

const setIndex = ref(0);
const currentSet = computed(() => heroImageSets[setIndex.value]);

// Resolves once every photo of the set has loaded at the width its tile will
// request (same srcset and sizes as HeroImage), so the swap never shows an
// empty tile. Rejects if one fails.
function preloadSet(set) {
    return Promise.all(set.map((image, index) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.sizes = index === 0 ? LARGE_SIZES : SMALL_SIZES;
        img.srcset = sizedImageSrcset(image.src, HERO_WIDTHS) ?? "";
        img.src = sizedImage(image.src, 800);
    })));
}

let timer = null;
let unmounted = false;

async function showNextSet() {
    const next = (setIndex.value + 1) % heroImageSets.length;

    try {
        await preloadSet(heroImageSets[next]);
    } catch {
        return; // A photo did not load: keep the current set and try again next time.
    }

    if (!unmounted && !document.hidden) setIndex.value = next;
}

function start() {
    if (timer === null) timer = setInterval(showNextSet, HERO_ROTATE_MS);
}

function stop() {
    clearInterval(timer);
    timer = null;
}

// Paused while the tab is hidden; resumes (a full minute later) when it is shown.
function onVisibilityChange() {
    if (document.hidden) stop();
    else start();
}

onMounted(() => {
    // Visitors who ask for reduced motion keep the first set.
    if (heroImageSets.length < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!document.hidden) start();
});

onBeforeUnmount(() => {
    unmounted = true;
    stop();
    document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>
