<template>
  <div class="hidden lg:flex lg:items-center lg:space-x-6">

    <RouterLink :to="ROUTES.LOGIN" class="text-sm font-medium text-gray-700 hover:text-gray-800">
      Sign In
    </RouterLink>

    <span class="h-6 w-px bg-gray-200" aria-hidden="true"></span>

    <RouterLink :to="ROUTES.REGISTER" class="text-sm font-medium text-gray-700 hover:text-gray-800">
      Create Account
    </RouterLink>

  </div>
</template>

<script setup>
import {RouterLink} from "vue-router";
import {ROUTES} from "@/config";
</script>