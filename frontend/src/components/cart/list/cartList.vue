<template>
    <div class="hide-scrollbar xl:max-h-160 xl:overflow-y-auto xl:pr-2">

        <div class="flex flex-col gap-4">

            <cartItem v-for="product in products" :key="product.id" :product="product"
                @update-quantity="handleUpdateQuantity" @remove-product="handleRemoveProduct" />

            <emptyCart v-if="!products.length" />

        </div>

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

<style scoped>
.hide-scrollbar {
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.hide-scrollbar::-webkit-scrollbar {
    display: none;
}
</style>