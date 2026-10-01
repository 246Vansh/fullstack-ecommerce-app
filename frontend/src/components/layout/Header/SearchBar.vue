<template>
  <form role="search" class="flex items-center gap-2" @submit.prevent="submit">

    <label for="site-search" class="sr-only">Search products</label>

    <input id="site-search" ref="input" v-model="term" type="search" name="search" maxlength="100"
      placeholder="Search products" autocomplete="off"
      class="block w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 sm:text-sm" />

    <button type="submit"
      class="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer">
      Search
    </button>

  </form>
</template>

<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

// Sends the shopper to /products?search=<term>; the catalog reads it from the URL.
const emit = defineEmits(["submitted"]);

const route = useRoute();
const router = useRouter();

const input = ref(null);

// Starts with the active search so the shopper can refine it.
const term = ref(route.name === "products" ? String([route.query.search].flat()[0] ?? "") : "");

async function submit() {

  const search = term.value.trim();

  if (!search) return;

  // A header search starts fresh, so other catalog parameters are dropped.
  const target = router.resolve({ name: "products", query: { search } });

  if (target.fullPath !== route.fullPath) {
    await router.push(target);
  }

  emit("submitted");

}

defineExpose({ focus: () => input.value?.focus() });
</script>
