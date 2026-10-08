<template>
    <div class="flex flex-col gap-8 border-t border-gray-200 pt-2">

        <!-- Color Selection -->

        <ColorSelector v-if="hasColors" :colors="product.colors" :selected-color="selectedColor"
            @select-color="selectColor" />

        <!-- Size Selection (hidden for one-size products such as bags) -->

        <SizeSelector v-if="hasSizes" :sizes="product.sizes" :selected-size="selectedSize"
            @select-size="selectSize" />

        <!-- Quantity -->

        <QuantitySelector :quantity="quantity" @increase="increaseQuantity" @decrease="decreaseQuantity" />

        <!-- Purchase Buttons -->

        <div>

            <PurchaseActions :disabled="!canPurchase" @add-to-cart="handleAddToCart" />

            <!-- Always rendered so screen readers announce each new message. -->
            <p role="status" class="text-sm font-medium" :class="[
                message.text ? 'mt-3' : '',
                message.type === 'error' ? 'text-red-600' : 'text-emerald-600',
            ]">
                {{ message.text }}
            </p>

        </div>

        <!-- Delivery Information -->
    </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

import ColorSelector from "./productColorSelector.vue";
import SizeSelector from "./productSizeSelector.vue";
import QuantitySelector from "./productQuantitySelector.vue";
import PurchaseActions from "./productPurchaseActions.vue";

import { useCartStore } from "@/stores/cartStore";
import { parseApiError } from "@/services/apiClient";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits(["variant-change"]);

const cart = useCartStore();

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

watch([selectedColor, selectedSize, quantity], () => {
    feedback.value = null;
});

// The summary shows the selected variant's price (null when no variant matches).
watch(selectedVariant, (variant) => emit("variant-change", variant), { immediate: true });

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
        await cart.addItem(variant.id, quantity.value, { productId: props.product.id, stock: variant.stock });

        feedback.value = { type: "success", text: "Added to your cart." };
    } catch (err) {
        feedback.value = { type: "error", text: err.response ? parseApiError(err).message : err.message };
    } finally {
        adding.value = false;
    }
};
</script>