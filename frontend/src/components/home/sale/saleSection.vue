<template>
    <section aria-labelledby="sale-heading" class="bg-white">
        <div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <!-- Section Header -->
            <SaleHeader />

            <!-- Gallery -->
            <SaleGallery />
        </div>
    </section>
</template>

<script setup>
import SaleHeader from "./SaleHeader.vue";
import SaleGallery from "./SaleGallery.vue";
</script>