<template>
    <!-- Same shape as ProductCard (4:5 photo, brand, name, price). -->
    <div v-if="loading" class="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
        <div v-for="n in placeholders" :key="n" aria-hidden="true">
            <div class="aspect-4/5 rounded-card bg-slate-100 motion-safe:animate-pulse"></div>
            <div class="mt-4 h-3 w-1/4 rounded-full bg-slate-100"></div>
            <div class="mt-3 h-4 w-3/4 rounded-full bg-slate-100"></div>
            <div class="mt-3 h-5 w-1/3 rounded-full bg-slate-100"></div>
        </div>
    </div>

    <!-- One row that slides left a card at a time, round and round the
         products. Clipped sideways only, so card shadows and focus rings
         above and below still show. -->
    <div v-else class="mt-10 -my-2 overflow-x-clip py-2 [--gap:1.5rem] xl:[--gap:2rem]"
        @focusin="focused = true" @focusout="onFocusOut">

        <div class="flex gap-(--gap)" :style="trackStyle">
            <!-- The card waiting off to the right is inert until it slides in.
                 Pointing at any product holds the row still. -->
            <div v-for="(product, i) in row" :key="product.id" class="shrink-0" :style="{ width: cardWidth }"
                :inert="i >= perView || undefined" @mouseenter="hovered = true" @mouseleave="hovered = false">
                <ProductCard :product="product" :image-sizes="IMAGE_SIZES" />
            </div>
        </div>

    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import ProductCard from "@/components/products/product/productCard.vue";

// Card slots in the max-w-7xl section: one column, two from sm, three
// (384px max) from lg, times the ~1.9 a 3:2 photo paints at under
// object-cover in the 4:5 card. Same value the old New Arrivals card used.
const IMAGE_SIZES = "(min-width: 1280px) 720px, (min-width: 1024px) 56vw, (min-width: 640px) 94vw, 188vw";

// Time each card stays put / time the slide to the next one takes.
const STEP_MS = 3000;
const SLIDE_MS = 700;

const props = defineProps({
    products: {
        type: Array,
        required: true,
    },
    loading: {
        type: Boolean,
        default: false,
    },
    placeholders: {
        type: Number,
        default: 3,
    },
});

// ------------------------------------------------------------ layout

// Cards in view, matching the placeholder grid's breakpoints.
const perView = ref(1);
const lg = window.matchMedia?.("(min-width: 1024px)");
const sm = window.matchMedia?.("(min-width: 640px)");
const updatePerView = () => { perView.value = lg?.matches ? 3 : sm?.matches ? 2 : 1; };
updatePerView();

const cardWidth = computed(() => `calc((100% - ${perView.value - 1} * var(--gap)) / ${perView.value})`);

// ------------------------------------------------------------ sliding

const start = ref(0);
const sliding = ref(false);

const canSlide = computed(() => props.products.length > perView.value);

// The cards in view plus the next one, waiting just off the right edge.
const row = computed(() => {
    const total = props.products.length;
    const count = Math.min(perView.value + (canSlide.value ? 1 : 0), total);
    return Array.from({ length: count }, (_, i) => props.products[(start.value + i) % total]);
});

// While sliding, the row moves one card (plus its gap) to the left. Then the
// first card is dropped, the waiting one becomes the last in view, and the
// transform resets in the same render, so nothing visibly jumps.
const trackStyle = computed(() => sliding.value
    ? { transform: `translateX(calc(-1 * (100% + var(--gap)) / ${perView.value}))`, transition: `transform ${SLIDE_MS}ms cubic-bezier(0.45, 0, 0.2, 1)` }
    : {});

// Held still while the pointer is over a product or focus is inside the row,
// and while the tab is hidden. When the hold ends, the product in view gets a
// full STEP_MS before the next slide, so the row never jumps on mouse-out.
const hovered = ref(false);
const focused = ref(false);

watch([hovered, focused], ([isHovered, isFocused]) => {
    if (isHovered || isFocused) stopStepping();
    else startStepping();
});

function onFocusOut(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) focused.value = false;
}

let stepTimer = null;
let slideTimer = null;
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function step() {
    if (sliding.value || !canSlide.value || hovered.value || focused.value || document.hidden) return;

    sliding.value = true;

    slideTimer = setTimeout(() => {
        start.value = (start.value + 1) % props.products.length;
        sliding.value = false;
    }, SLIDE_MS);
}

// Visitors who ask for reduced motion keep the newest products in place.
function startStepping() {
    if (!reducedMotion && stepTimer === null) stepTimer = setInterval(step, STEP_MS);
}

function stopStepping() {
    clearInterval(stepTimer);
    stepTimer = null;
}

// A new list (or fewer of them) starts from its first product.
watch(() => props.products, () => { start.value = 0; });

onMounted(() => {
    lg?.addEventListener("change", updatePerView);
    sm?.addEventListener("change", updatePerView);

    startStepping();
});

onBeforeUnmount(() => {
    stopStepping();
    clearTimeout(slideTimer);
    lg?.removeEventListener("change", updatePerView);
    sm?.removeEventListener("change", updatePerView);
});
</script>
