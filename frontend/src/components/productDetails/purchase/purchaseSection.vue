<template>
    <div class="flex flex-col gap-8 border-t border-gray-200 pt-2">

        <!-- Color Selection -->

        <ColorSelector :colors="product.colors" :selected-color="selectedColor" @select-color="selectColor" />

        <!-- Size Selection -->

        <SizeSelector :sizes="product.sizes" :selected-size="selectedSize" @select-size="selectSize" />

        <!-- Quantity -->

        <QuantitySelector :quantity="quantity" @increase="increaseQuantity" @decrease="decreaseQuantity" />

        <!-- Purchase Buttons -->

        <PurchaseActions :purchase="purchase" :disabled="!canPurchase" />

        <!-- Delivery Information -->
    </div>
</template>

<script setup>
import { ref, computed } from "vue";

import ColorSelector from "./productColorSelector.vue";
import SizeSelector from "./productSizeSelector.vue";
import QuantitySelector from "./productQuantitySelector.vue";
import PurchaseActions from "./productPurchaseActions.vue";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

// ==================================================
// State
// ==================================================

const quantity = ref(1);

const selectedColor = ref(
    props.product.colors?.[0] ?? null
);

const selectedSize = ref(
    props.product.sizes?.[0] ?? null
);

const canPurchase = computed(() => {
    return (
        selectedColor.value &&
        selectedSize.value &&
        quantity.value > 0
    );
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

const handleAddToCart = () => {
    const purchase = {
        product: props.product,
        color: selectedColor.value,
        size: selectedSize.value,
        quantity: quantity.value,
    };

    console.log("Add To Cart", purchase);

    // Next sprint:
    // cartStore.addItem(purchase)
};

const handleBuyNow = () => {
    const purchase = {
        product: props.product,
        color: selectedColor.value,
        size: selectedSize.value,
        quantity: quantity.value,
    };

    console.log("Buy Now", purchase);

    // Next sprint:
    // router.push("/checkout")
};

const purchase = computed(() => ({
    product: props.product,
    color: selectedColor.value,
    size: selectedSize.value,
    quantity: quantity.value,
}));
</script>