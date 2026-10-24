<template>
  <div class="flex lg:ml-0">
    <RouterLink to="/"
      class="rounded-md text-xl font-bold tracking-tight text-brand transition-colors hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
      {{ APP_CONFIG.appName }}
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';
import { APP_CONFIG } from "@/config";
</script>
