<script setup>

import { footerNavigation } from "@/constants/navigation";
import {RouterLink} from "vue-router"
</script>

<template>

 <div class="mt-16 border-t border-gray-200 py-8 md:flex md:items-center md:justify-between">
          <div class="text-center md:text-left">
            <p class="text-sm text-gray-500">© {{ new Date().getFullYear() }} Your Company. All rights reserved.</p>
          </div>

          <div class="mt-4 flex items-center justify-center md:mt-0">
            <div class="flex space-x-8">
              <a v-for="item in footerNavigation.bottomLinks" :key="item.name" to="#" class="text-sm text-gray-500 hover:text-gray-600">{{ item.name }}</a>
            </div>

            <div class="ml-6 border-l border-gray-200 pl-6">
              <ROuterLink to="/" class="flex items-center text-gray-500 hover:text-gray-600">
                <img src="https://tailwindcss.com/plus-assets/img/flags/flag-canada.svg" alt="" class="h-auto w-5 shrink-0" />
                <span class="ml-3 text-sm">Change</span>
                <span class="sr-only">location and currency</span>
              </ROuterLink>
            </div>
          </div>
        </div>

</template>