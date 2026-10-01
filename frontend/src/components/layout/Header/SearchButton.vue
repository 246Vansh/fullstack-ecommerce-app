<template>
  <div class="flex lg:ml-6">

    <button type="button" class="p-2 text-gray-400 hover:text-gray-500 cursor-pointer" :aria-expanded="open"
      aria-controls="header-search" @click="toggle">
      <span class="sr-only">{{ open ? "Close search" : "Search" }}</span>
      <XMarkIcon v-if="open" class="size-6" aria-hidden="true" />
      <MagnifyingGlassIcon v-else class="size-6" aria-hidden="true" />
    </button>

    <!-- Positioned against the <header>, so it spans the full width below it. -->
    <div v-if="open" id="header-search"
      class="absolute inset-x-0 top-full z-30 border-b border-gray-200 bg-white shadow-sm"
      @keydown.esc="close">
      <div class="mx-auto max-w-2xl px-4 py-4 sm:px-6 lg:px-8">
        <SearchBar ref="searchBar" @submitted="close" />
      </div>
    </div>

  </div>
</template>

<script setup>
import { nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/vue/24/outline";

import SearchBar from "./SearchBar.vue";

const open = ref(false);

const searchBar = ref(null);

async function toggle() {
  open.value = !open.value;

  if (open.value) {
    await nextTick();
    searchBar.value?.focus();
  }
}

function close() {
  open.value = false;
}

// Any navigation (a search, a menu link) closes the panel.
const route = useRoute();
watch(() => route.fullPath, close);
</script>
