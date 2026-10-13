<template>
    <!-- Placeholder until the product forms (Phase 12.2B). It loads and shows
         no product data, and saves nothing. -->
    <div class="mx-auto max-w-3xl">

        <RouterLink :to="{ name: 'admin-products' }"
            class="inline-flex items-center gap-1 rounded text-sm font-medium text-indigo-700 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600">
            <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
            Back to products
        </RouterLink>

        <h1 class="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {{ isEdit ? `Edit product #${route.params.id}` : "New product" }}
        </h1>

        <section
            class="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h2 class="text-lg font-bold text-slate-900">Not available yet</h2>
            <p class="mx-auto mt-2 max-w-md text-slate-500">
                {{ isEdit ? "Editing products" : "Creating products" }} from the admin dashboard is coming
                in the next update. Nothing on this page is saved.
            </p>
        </section>

    </div>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { ChevronLeftIcon } from "@heroicons/vue/20/solid";

const route = useRoute();
const isEdit = computed(() => route.name === "admin-product-edit");
</script>
