<template>
    <!-- Flows with the page: no inner scroll area, so every item is reachable. -->
    <div class="flex flex-col gap-3">

        <cartItem v-for="product in products" :key="product.id" :product="product"
            @update-quantity="handleUpdateQuantity" @remove-product="handleRemoveProduct" />

        <emptyCart v-if="!products.length" />

    </div>
</template>

<script setup>
import cartItem from "./cartItem.vue";
import emptyCart from "../empty/emptyCart.vue";

defineProps({
    products: {
        type: Array,
        default: () => [],
    },
});

const emit = defineEmits([
    "updateQuantity",
    "removeProduct",
]);

function handleUpdateQuantity(payload) {
    emit("updateQuantity", payload);
}

function handleRemoveProduct(id) {
    emit("removeProduct", id);
}
</script>
