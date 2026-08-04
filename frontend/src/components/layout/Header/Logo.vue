<template>
  <div class="flex lg:ml-0">
    <RouterLink to="/">
      <span class="sr-only">
        Your Company
      </span>

      <img
        class="h-8 w-auto"
        src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
        alt="Company Logo"
      />
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';
</script>