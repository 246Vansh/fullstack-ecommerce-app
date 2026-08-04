<template>
    <section aria-labelledby="favorites-heading" class="bg-gray-50">
        <div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">

            <!-- Section Header -->
            <SectionHeader heading-id="favorites-heading" title="Our Favorites" link-text="Shop the collection"
                link-href="#" />

            <!-- Product Grid -->
            <FavoriteGrid />

        </div>
    </section>
</template>

<script setup>
import SectionHeader from "@/components/ui/sectionHeader.vue";
import FavoriteGrid from "./favoriteGrid.vue";
</script>