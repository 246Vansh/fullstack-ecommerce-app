<script setup>
import { RouterLink } from "vue-router";
import { footerNavigation } from "@/constants/navigation";
</script>

<template>
    <div class="mx-auto xl:grid xl:grid-cols-2 xl:gap-8 py-10">
      <div class="grid grid-cols-2 xl:col-span-2">
        <div class="space-y-12 md:grid md:grid-cols-2 md:gap-8 md:space-y-0">
          <div v-if="footerNavigation.products.length">
            <h3 class="text-sm font-medium text-gray-900">Products</h3>
            <ul role="list" class="mt-6 space-y-6">
              <li v-for="item in footerNavigation.products" :key="item.name" class="text-sm">
                <RouterLink :to="item.to" class="text-gray-500 hover:text-gray-600">{{ item.name }}</RouterLink>
              </li>
            </ul>
          </div>
          <div v-if="footerNavigation.customerService.length">
            <h3 class="text-sm font-medium text-gray-900">Customer Service</h3>
            <ul role="list" class="mt-6 space-y-6">
              <li v-for="item in footerNavigation.customerService" :key="item.name" class="text-sm">
                <RouterLink :to="item.to" class="text-gray-500 hover:text-gray-600">{{ item.name }}</RouterLink>
              </li>
            </ul>
          </div>
        </div>
        <div class="space-y-12 md:grid md:grid-cols-2 md:gap-8 md:space-y-0">
          <div v-if="footerNavigation.company.length">
            <h3 class="text-sm font-medium text-gray-900">Company</h3>
            <ul role="list" class="mt-6 space-y-6">
              <li v-for="item in footerNavigation.company" :key="item.name" class="text-sm">
                <RouterLink :to="item.to" class="text-gray-500 hover:text-gray-600">{{ item.name }}</RouterLink>
              </li>
            </ul>
          </div>
          <div v-if="footerNavigation.legal.length">
            <h3 class="text-sm font-medium text-gray-900">Legal</h3>
            <ul role="list" class="mt-6 space-y-6">
              <li v-for="item in footerNavigation.legal" :key="item.name" class="text-sm">
                <RouterLink :to="item.to" class="text-gray-500 hover:text-gray-600">{{ item.name }}</RouterLink>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

</template>