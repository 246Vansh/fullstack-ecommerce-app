<template>

 <div class="mt-16 border-t border-gray-200 py-8 md:flex md:items-center md:justify-between">
          <div class="text-center md:text-left">
            <p class="text-sm text-gray-500">© {{ new Date().getFullYear() }} {{ APP_CONFIG.appName }}. All rights reserved.</p>
          </div>
        </div>

</template>

<script setup>
import { APP_CONFIG } from "@/config";
</script>