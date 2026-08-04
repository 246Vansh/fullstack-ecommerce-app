<template>
    <div class="group relative">

        <!-- Product Image -->
        <div class="aspect-rectangle w-full overflow-hidden rounded-lg bg-gray-100">
            <img :src="product.image" :alt="product.alt"
                class="h-full w-full object-cover object-center transition-opacity duration-300 group-hover:opacity-75" />
        </div>

        <!-- Product Info -->
        <div class="mt-4 flex items-center justify-between">

            <div>

                <h3 class="text-sm font-medium text-gray-900">
                    <RouterLink to="/products">

                        <span aria-hidden="true" class="absolute inset-0"></span>

                        {{ product.name }}

                    </RouterLink>
                </h3>

            </div>

            <p class="text-sm font-medium text-gray-900">
                {{ product.price }}
            </p>

        </div>

    </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';

defineProps({
    product: {
        type: Object,
        required: true,
    },
});

</script>