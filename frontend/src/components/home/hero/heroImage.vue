<template>
  <div class="overflow-hidden rounded-lg bg-gray-100 group" :class="image.class">
    <img :src="image.src" :alt="image.alt"
      class="h-full w-full object-cover duration-300 ease-in-out group-hover:opacity-75"
      loading="lazy" />
  </div>
</template>

<script setup>
defineProps({
  image: {
    type: Object,
    required: true,
  },
});
</script>