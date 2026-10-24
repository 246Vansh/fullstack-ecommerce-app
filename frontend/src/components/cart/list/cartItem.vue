<template>
    <!-- Photo on the left; name, options and price beside it; quantity and Remove underneath. -->
    <article class="flex gap-4 rounded-card border border-slate-200 bg-white p-4 sm:gap-5 sm:p-5"
        :class="product.isAvailable === false ? 'border-red-200' : ''">

        <cartImage :product="product" />

        <div class="flex min-w-0 flex-1 flex-col">

            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">

                <cartInfo :product="product" />

                <cartPrice :product="product" />

            </div>

            <cartActions class="mt-auto pt-4" :product="product" @update-quantity="updateQuantity" @remove-product="removeProduct" />

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
