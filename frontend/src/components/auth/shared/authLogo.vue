<template>
    <!-- Block wrapper so authHeader's margin classes apply; the store name
         links home, as the header logo does on every other page. -->
    <div>
        <RouterLink :to="ROUTES.HOME"
            class="inline-flex min-h-11 items-center rounded-md text-xl font-bold tracking-tight text-brand transition-colors hover:text-brand-hover outline-brand focus-visible:outline-2 focus-visible:outline-offset-4">
            {{ APP_CONFIG.appName }}
        </RouterLink>
    </div>
</template>

<script setup>
import { RouterLink } from "vue-router";

import { APP_CONFIG, ROUTES } from "@/config";
</script>
