<template>
    <div class="space-y-10">

        <!-- About Product (only the description the API returns; there is no
             per-product highlights, material or care data yet) -->
        <section class="overflow-hidden rounded-2xl bg-gradient-to-r from-sky-50 via-blue-50 to-blue-50">

            <div class="p-6 lg:p-8">

                <h2 class="text-2xl font-bold text-gray-900">
                    About this product
                </h2>

                <p class="mt-5 leading-8 text-gray-600">
                    {{ product.description }}
                </p>

            </div>
        </section>

    </div>
</template>

<script setup>
defineProps({
    product: {
        type: Object,
        required: true,
    },
});
</script>
