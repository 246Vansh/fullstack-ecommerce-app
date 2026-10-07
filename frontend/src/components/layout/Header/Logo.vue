<template>
  <div class="flex lg:ml-0">
    <RouterLink to="/" class="text-lg font-bold tracking-tight text-indigo-600">
      {{ APP_CONFIG.appName }}
    </RouterLink>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';
import { APP_CONFIG } from "@/config";
</script>
