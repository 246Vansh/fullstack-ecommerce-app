<template>
    <div class="flex flex-col gap-6 border-t border-slate-200 pt-6">

        <!-- Color Selection -->

        <ColorSelector v-if="hasColors" :colors="product.colors" :selected-color="selectedColor"
            :unavailable-ids="unavailableColorIds" @select-color="selectColor" />

        <!-- Size Selection (hidden for one-size products such as bags) -->

        <SizeSelector v-if="hasSizes" :sizes="product.sizes" :selected-size="selectedSize"
            :unavailable-ids="unavailableSizeIds" @select-size="selectSize" />

        <!-- Quantity + Add to Cart -->

        <div ref="actions">

            <!-- Stock for the selected option; problems are explained by the message below. -->
            <p v-if="selectedVariant && selectedVariant.stock > 0"
                class="mb-4 flex items-center gap-2 text-sm font-medium"
                :class="lowStock ? 'text-amber-700' : 'text-brand'">
                <span class="h-2 w-2 rounded-full" :class="lowStock ? 'bg-amber-500' : 'bg-brand'" aria-hidden="true" />
                {{ lowStock ? `Only ${selectedVariant.stock} left in stock` : "In stock" }}
            </p>

            <div class="flex items-stretch gap-3">

                <QuantitySelector :quantity="quantity" :max="selectedVariant?.stock ?? null"
                    @increase="increaseQuantity" @decrease="decreaseQuantity" />

                <PurchaseActions class="flex-1" :disabled="!canPurchase" :loading="adding" @add-to-cart="handleAddToCart" />

            </div>

            <!-- Always rendered so screen readers announce each new message. -->
            <p role="status" class="text-sm font-medium" :class="[
                message.text ? 'mt-3' : '',
                message.type === 'error' ? 'text-red-700' : 'text-brand',
            ]">
                {{ message.text }}
            </p>

            <RouterLink v-if="feedback?.type === 'success'" :to="{ name: 'cart' }"
                class="mt-1 inline-flex min-h-9 items-center gap-1 rounded-sm text-sm font-semibold text-slate-900 underline underline-offset-4 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                View cart
                <span aria-hidden="true">&rarr;</span>
            </RouterLink>

        </div>

        <!-- Delivery Information (only what is true today) -->

        <ul class="space-y-2.5 border-t border-slate-200 pt-6 text-sm text-slate-600">
            <li class="flex items-center gap-3">
                <TruckIcon class="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                Shipping is calculated at checkout
            </li>
            <li class="flex items-center gap-3">
                <ShieldCheckIcon class="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                Secure checkout
            </li>
        </ul>

        <!-- Mobile purchase bar: once the shopper scrolls past the main button,
             below lg only. Hidden again over the footer so it never covers it.
             Teleported out of <main> into its own "Quick purchase" landmark, so
             it is not mistaken for the page's main Add to Cart: both keep the
             visible label, and each can be found by its landmark. -->

        <Teleport to="body">
        <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="translate-y-full"
            enter-to-class="translate-y-0" leave-active-class="transition duration-150 ease-in"
            leave-from-class="translate-y-0" leave-to-class="translate-y-full">

            <section v-if="showStickyBar" aria-label="Quick purchase"
                class="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-raised backdrop-blur-md sm:px-6 lg:hidden">

                <div class="mx-auto flex max-w-7xl items-center gap-4">

                    <div class="min-w-0 flex-1">

                        <p class="truncate text-sm font-medium text-slate-900">{{ product.name }}</p>

                        <p v-if="feedback" aria-hidden="true" class="truncate text-sm font-medium"
                            :class="feedback.type === 'error' ? 'text-red-700' : 'text-brand'">
                            {{ feedback.text }}
                        </p>

                        <p v-else class="text-sm font-semibold text-slate-900">{{ stickyPrice }}</p>

                    </div>

                    <PrimaryButton v-if="feedback?.type === 'success'" :to="{ name: 'cart' }" variant="outline" class="shrink-0">
                        View cart
                    </PrimaryButton>

                    <PrimaryButton v-else tag="button" class="shrink-0" :disabled="!canPurchase" :loading="adding"
                        @click="handleAddToCart">
                        Add to Cart
                    </PrimaryButton>

                </div>

            </section>

        </Transition>
        </Teleport>

    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { RouterLink } from "vue-router";
import { ShieldCheckIcon, TruckIcon } from "@heroicons/vue/24/outline";

import ColorSelector from "./productColorSelector.vue";
import SizeSelector from "./productSizeSelector.vue";
import QuantitySelector from "./productQuantitySelector.vue";
import PurchaseActions from "./productPurchaseActions.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";

import { useCartStore } from "@/stores/cartStore";
import { parseApiError } from "@/services/apiClient";
import { formatPrice } from "@/utils/money";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits(["variant-change"]);

const cart = useCartStore();

// At or below this many, the stock line warns "Only N left".
const LOW_STOCK = 5;

// ==================================================
// State
// ==================================================

const variants = computed(() => props.product.variants ?? []);

// A selector is only required when the product's variants actually vary by it.
const hasColors = computed(() => (props.product.colors?.length ?? 0) > 0);
const hasSizes = computed(() => (props.product.sizes?.length ?? 0) > 0);

// Start on the first in-stock variant so the default choice can be bought.
const initialVariant = variants.value.find((variant) => variant.stock > 0) ?? variants.value[0];

const quantity = ref(1);

const selectedColor = ref(
    props.product.colors?.find((color) => color.name === initialVariant?.color)
    ?? props.product.colors?.[0]
    ?? null
);

const selectedSize = ref(
    props.product.sizes?.find((size) => size.name === initialVariant?.size)
    ?? props.product.sizes?.[0]
    ?? null
);

// The exact ProductVariant for the current selection; sizeless variants
// have size null, which matches an unselected (hidden) size.
const selectedVariant = computed(() => variants.value.find((variant) =>
    (variant.color ?? null) === (selectedColor.value?.name ?? null)
    && (variant.size ?? null) === (selectedSize.value?.name ?? null)
) ?? null);

const lowStock = computed(() => (selectedVariant.value?.stock ?? 0) <= LOW_STOCK);

// Options with no in-stock variant alongside the other current choice. They
// stay selectable (the message explains); they are only marked.
const unavailableColorIds = computed(() => (props.product.colors ?? [])
    .filter((color) => !variants.value.some((variant) =>
        variant.color === color.name
        && (!hasSizes.value || variant.size === selectedSize.value?.name)
        && variant.stock > 0))
    .map((color) => color.id));

const unavailableSizeIds = computed(() => (props.product.sizes ?? [])
    .filter((size) => !variants.value.some((variant) =>
        variant.size === size.name
        && (!hasColors.value || variant.color === selectedColor.value?.name)
        && variant.stock > 0))
    .map((size) => size.id));

const adding = ref(false);

const feedback = ref(null);

// Explains why the button is disabled, unless an add just succeeded/failed.
const message = computed(() => {
    if (feedback.value) return feedback.value;

    const variant = selectedVariant.value;

    if ((hasColors.value && !selectedColor.value) || (hasSizes.value && !selectedSize.value)) {
        return { type: "error", text: "Please select a color and size." };
    }

    if (!variant) return { type: "error", text: "This combination is not available." };

    if (variant.stock === 0) return { type: "error", text: "This option is out of stock." };

    if (quantity.value > variant.stock) {
        return { type: "error", text: `Only ${variant.stock} left in stock.` };
    }

    return { type: "info", text: "" };
});

const canPurchase = computed(() => {
    const variant = selectedVariant.value;

    return Boolean(
        variant &&
        variant.stock > 0 &&
        quantity.value > 0 &&
        quantity.value <= variant.stock &&
        !adding.value
    );
});

// Same rule as the summary price: a variant price overrides the product price.
const stickyPrice = computed(() => formatPrice(
    selectedVariant.value?.price ?? props.product.price,
    props.product.currency,
));

watch([selectedColor, selectedSize, quantity], () => {
    feedback.value = null;
});

// The summary shows the selected variant's price (null when no variant matches).
watch(selectedVariant, (variant) => emit("variant-change", variant), { immediate: true });

// ==================================================
// Mobile purchase bar
// ==================================================

const actions = ref(null);

const showStickyBar = ref(false);

// Measured on scroll rather than with an IntersectionObserver: that only
// reports crossings, so a jump from the footer straight back to the top
// (actions off-screen before and after) would leave the bar showing.
let footer = null;
let frame = 0;

function updateStickyBar() {
    frame = 0;

    if (!actions.value) return;

    // Only above the viewport: below it (first screen on a small phone) the
    // shopper has not reached the button yet.
    const scrolledPast = actions.value.getBoundingClientRect().bottom < 0;
    const footerVisible = Boolean(footer) && footer.getBoundingClientRect().top < window.innerHeight;

    showStickyBar.value = scrolledPast && !footerVisible;
}

function onScroll() {
    if (!frame) frame = requestAnimationFrame(updateStickyBar);
}

onMounted(() => {
    footer = document.querySelector("footer");

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    updateStickyBar();
});

onBeforeUnmount(() => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);

    if (frame) cancelAnimationFrame(frame);
});

// ==================================================
// Methods
// ==================================================

const selectColor = (color) => {
    selectedColor.value = color;
};

const selectSize = (size) => {
    selectedSize.value = size;
};

const increaseQuantity = () => {
    quantity.value++;
};

const decreaseQuantity = () => {
    if (quantity.value > 1) {
        quantity.value--;
    }
};

// Signed in: sends only variantId and quantity; the server prices it and checks stock.
// Guest: stored locally (productId is the catalog lookup key) and merged after login.
const handleAddToCart = async () => {
    if (!canPurchase.value) return;

    const variant = selectedVariant.value;

    adding.value = true;

    try {
        await cart.addItem(variant.id, quantity.value, { productId: props.product.id, stock: variant.stock, currency: props.product.currency });

        feedback.value = { type: "success", text: "Added to your cart." };
    } catch (err) {
        feedback.value = { type: "error", text: err.response ? parseApiError(err).message : err.message };
    } finally {
        adding.value = false;
    }
};
</script>
