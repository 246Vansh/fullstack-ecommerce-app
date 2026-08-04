<template>
    <article class="grid items-start gap-6 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-all duration-300 hover:shadow-md
           lg:grid-cols-[170px_minmax(0,1fr)_160px_130px]">
        <cartImage :product="product" />

        <cartInfo :product="product" />

        <div class="flex h-full flex-col items-center justify-center gap-4">
            <cartActions :product="product" @update-quantity="updateQuantity" @remove-product="removeProduct" />
        </div>

        <div class="flex h-full flex-col items-end justify-between">
            <cartPrice :product="product" />
        </div>
    </article>
</template>

<script setup>
import cartActions from "./cartActions.vue";
import cartImage from "./cartImage.vue";
import cartInfo from "./cartInfo.vue";
import cartPrice from "./cartPrice.vue";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const emit = defineEmits([
    "updateQuantity",
    "removeProduct",
]);

function updateQuantity(quantity) {
    emit("updateQuantity", {
        productId: props.product.id,
        quantity,
    });
}

function removeProduct() {
    emit("removeProduct", props.product.id);
}
</script>