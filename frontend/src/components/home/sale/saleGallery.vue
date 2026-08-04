<template>
  <div
    class="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2"
  >

    <SaleImage
      v-for="image in saleImages"
      :key="image.id"
      :image="image"
      :class="[
        image.layout === 'large'
          ? 'sm:row-span-2'
          : ''
      ]"
    />

  </div>
</template>

<script setup>
import SaleImage from "./saleImage.vue";
import { saleImages } from "@/constants/saleImages";
</script>