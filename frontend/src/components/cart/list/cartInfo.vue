<template>
    <div class="flex flex-col justify-between">
        <div>
            <h3 class="text-2xl font-bold text-slate-900">
                {{ product.name }}
            </h3>

            <p class="mt-1 text-lg text-gray-500">
                {{ brand }}
            </p>

            <div class="flex flex-wrap items-center gap-3 text-gray-500">

                <span>
                    {{ color }}
                </span>

                <template v-if="size">

                    <span>•</span>

                    <span>
                        {{ size }}
                    </span>

                </template>

            </div>
        </div>

        <div>

            <!-- Removed from the catalog, sold out, or quantity above current stock -->
            <div v-if="product.isAvailable === false" class="flex items-center gap-2 text-red-600">

                <div class="h-2.5 w-2.5 rounded-full bg-red-500" />

                <span class="font-medium">
                    {{ product.stock > 0 ? `Only ${product.stock} left` : "Unavailable" }}
                </span>

            </div>

            <div v-else-if="product.stock > 5" class="flex items-center gap-2 text-emerald-600">

                <div class="h-2.5 w-2.5 rounded-full bg-emerald-500" />

                <span class="font-medium">
                    In Stock
                </span>

            </div>

            <div v-else class="flex items-center gap-2 text-amber-500">

                <div class="h-2.5 w-2.5 rounded-full bg-amber-500" />

                <span class="font-medium">
                    Low Stock ({{ product.stock }} left)
                </span>

            </div>

        </div>
    </div>
</template>

<script setup>
import { computed } from "vue";
import { brands } from "../../../constants/catalog/brands";
import { colors } from "../../../constants/catalog/colors";
import { sizes } from "../../../constants/catalog/sizes";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

// Server cart items carry brand/color/size as strings; the id lookups
// remain for the older constant-based product shape.
const brand = computed(() => {
    return (
        props.product.brand ||
        brands.find(
            item => item.id === props.product.brandId
        )?.name || "Unknown Brand"
    );
});

const color = computed(() => {
    return props.product.color || props.product.colorIds
        ?.map(id => colors.find(color => color.id === id)?.name)
        .filter(Boolean)
        .join(" , ") || "Unknown Color"
});

// Empty for one-size variants (bags, caps, ...), which hides the size.
const size = computed(() => {
    if ("size" in props.product) return props.product.size;

    return props.product.sizeIds
        ?.map(id => sizes.find(size => size.id === id)?.name)
        .filter(Boolean)
        .join(" , ") || "Unknown Size";

});
</script>