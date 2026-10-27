<template>
  <div class="flex">

    <button ref="toggleButton" type="button"
      class="inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
      :aria-expanded="open"
      aria-controls="header-search" @click="toggle">
      <span class="sr-only">{{ open ? "Close search" : "Search" }}</span>
      <XMarkIcon v-if="open" class="size-6" aria-hidden="true" />
      <MagnifyingGlassIcon v-else class="size-6" aria-hidden="true" />
    </button>

    <!-- Positioned against the <header>, so it spans the full width below it. -->
    <div v-if="open" id="header-search"
      class="absolute inset-x-0 top-full z-30 border-b border-slate-200 bg-white shadow-raised"
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

const toggleButton = ref(null);

async function toggle() {
  open.value = !open.value;

  if (open.value) {
    await nextTick();
    searchBar.value?.focus();
  }
}

// Focus inside the panel would be lost when it unmounts, so it goes back to
// the toggle; a navigation to another page then moves it to that page.
function close() {
  if (open.value && document.getElementById("header-search")?.contains(document.activeElement)) {
    toggleButton.value?.focus();
  }

  open.value = false;
}

// Any navigation (a search, a menu link) closes the panel.
const route = useRoute();
watch(() => route.fullPath, close);
</script>
