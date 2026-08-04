<template>
  <section aria-labelledby="category-heading" class="bg-gray-50">
    <div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">

      <!-- Section Header -->
      <SectionHeader heading-id="category-heading" title="Shop by Category" link-text="Browse all categories"
        link-href="/" />

      <!-- Category Grid -->
      <div class="mt-6 grid grid-cols-1 gap-y-6 sm:grid-cols-2 sm:grid-rows-2 sm:gap-x-6 lg:gap-8">

        <CategoryCard v-for="category in categories" :key="category.id" :card="category" />

      </div>

    </div>
  </section>
</template>

<script setup>
import SectionHeader from "@/components/ui/sectionHeader.vue"
import CategoryCard from "./categoryCard.vue";
import { categories } from "@/constants/categories";
</script>