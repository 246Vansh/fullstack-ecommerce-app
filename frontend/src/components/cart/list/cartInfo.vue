<template>
    <div class="min-w-0">

        <!-- Brand only when the product has one; nothing is shown in its place. -->
        <p v-if="product.brand" class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {{ product.brand }}
        </p>

        <h3 class="mt-0.5 text-base leading-6 font-semibold text-slate-900">
            <RouterLink :to="{ name: 'product-details', params: { id: product.productId } }"
                class="rounded-sm hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                {{ product.name }}
            </RouterLink>
        </h3>

        <!-- The variant's real options only (one-size or colourless variants have none). -->
        <p v-if="options.length" class="mt-1 text-sm text-slate-600">
            {{ options.join(" · ") }}
        </p>

        <!-- Removed from the catalog, sold out, or quantity above current stock -->
        <p v-if="product.isAvailable === false" class="mt-2 flex items-center gap-2 text-sm font-medium text-red-700">
            <span class="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />
            <!-- "Only N left" only when the quantity is the problem; a deactivated
                 product or option can still have stock but cannot be bought. -->
            {{ product.stock > 0 && product.quantity > product.stock ? `Only ${product.stock} left — lower the quantity` : "Unavailable" }}
        </p>

        <p v-else-if="product.stock <= 5" class="mt-2 flex items-center gap-2 text-sm font-medium text-amber-700">
            <span class="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
            Only {{ product.stock }} left
        </p>

        <p v-else class="mt-2 flex items-center gap-2 text-sm font-medium text-brand">
            <span class="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
            In stock
        </p>

    </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const options = computed(() => [props.product.color, props.product.size].filter(Boolean));
</script>
