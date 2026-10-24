<template>
  <form role="search" class="flex items-center gap-2" @submit.prevent="submit">

    <label for="site-search" class="sr-only">Search products</label>

    <input id="site-search" ref="input" v-model="term" type="search" name="search" maxlength="100"
      placeholder="Search products" autocomplete="off"
      class="block min-h-11 w-full min-w-0 rounded-control border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 sm:text-sm" />

    <button type="submit"
      class="min-h-11 shrink-0 rounded-control bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer">
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
