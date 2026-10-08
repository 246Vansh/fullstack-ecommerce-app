<template>
    <!-- Every page renders <main id="main-content">; the link moves focus there
         without adding a #hash to the URL (the router would treat it as a navigation). -->
    <a href="#main-content"
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-indigo-700 focus:shadow-lg focus:ring-2 focus:ring-indigo-600"
        @click.prevent="focusMainContent()">
        Skip to main content
    </a>

    <RouterView />
</template>

<script setup>
import { RouterView } from "vue-router";

import { focusMainContent } from "@/router/pageFocus";
</script>
