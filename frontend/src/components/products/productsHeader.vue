<template>
    <section class="border-b border-gray-200 pb-6" aria-labelledby="products-heading">
        <!-- Breadcrumb -->

        <!--<slot name="breadcrumb" />-->

        <!-- Header -->

        <div class="mt-2 flex items-end justify-between gap-6">

            <div>

                <h1 id="products-heading" class="text-4xl font-bold tracking-tight text-gray-900">
                    {{ title }}
                </h1>

                <p v-if="description" class="mt-3 max-w-2xl text-sm text-gray-500">
                    {{ description }}
                </p>

            </div>

            <div class="shrink-0">

                <p class="text-sm text-gray-500">

                    <span class="font-semibold text-gray-900">
                        {{ totalProducts }}
                    </span>

                    Products

                </p>

            </div>

        </div>

    </section>
</template>

<script setup>

defineProps({

    title: {
        type: String,
        required: true,
    },

    description: {
        type: String,
        default: "",
    },

    totalProducts: {
        type: Number,
        default: 0,
    },

});
</script>