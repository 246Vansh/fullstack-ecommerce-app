<template>
    <div class="flex flex-col justify-between">
        <div>
            <h3 class="text-2xl font-bold text-slate-900">
                {{ product.name }}
            </h3>

            <p class="mt-1 text-lg text-gray-500">
                {{ brand }}
            </p>

            <div class="flex items-center gap-3">
                <productRating :rating="product.rating" :review-count="product.reviewCount" />
            </div>

            <div class="flex flex-wrap items-center gap-3 text-gray-500">

                <span>
                    {{ color }}
                </span>

                <span>•</span>

                <span>
                    {{ size }}
                </span>

            </div>
        </div>

        <div>

            <div v-if="product.stock > 5" class="flex items-center gap-2 text-emerald-600">

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
import productRating from "@/components/ui/productRating.vue";
import { brands } from "../../../constants/catalog/brands";
import { colors } from "../../../constants/catalog/colors";
import { sizes } from "../../../constants/catalog/sizes";

const props = defineProps({
    product: {
        type: Object,
        required: true,
    },
});

const brand = computed(() => {
    return (
        brands.find(
            item => item.id === props.product.brandId
        )?.name || "Unknown Brand"
    );
});

const color = computed(() => {
    return props.product.colorIds
        ?.map(id => colors.find(color => color.id === id)?.name)
        .filter(Boolean)
        .join(" , ") || "Unknown Color"
});

const size = computed(() => {
    return props.product.sizeIds
        ?.map(id => sizes.find(size => size.id === id)?.name)
        .filter(Boolean)
        .join(" , ") || "Unknown Size";

});
</script>