<template>
  <div class="flex lg:ml-6">

    <RouterLink to="/" class="p-2 text-gray-400 hover:text-gray-500">
      <span class="sr-only">Search</span>
      <MagnifyingGlassIcon class="size-6" aria-hidden="true" />
    </RouterLink>

  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';
// Import the outline version of the MagnifyingGlassIcon
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
</script>