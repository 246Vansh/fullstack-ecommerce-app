<template>
  <div class="hidden lg:flex lg:items-center lg:space-x-6">

    <!-- Signed in -->
    <template v-if="auth.isAuthenticated">

      <span class="text-sm font-medium text-gray-700">
        Hi, {{ auth.user.firstName }}
      </span>

      <span class="h-6 w-px bg-gray-200" aria-hidden="true"></span>

      <RouterLink :to="ROUTES.ORDERS" class="text-sm font-medium text-gray-700 hover:text-gray-800">
        Orders
      </RouterLink>

      <span class="h-6 w-px bg-gray-200" aria-hidden="true"></span>

      <button type="button" :disabled="loggingOut"
        class="text-sm font-medium text-gray-700 hover:text-gray-800 cursor-pointer disabled:opacity-50"
        @click="logout">
        Logout
      </button>

    </template>

    <!-- Guest -->
    <template v-else>

      <RouterLink :to="ROUTES.LOGIN" class="text-sm font-medium text-gray-700 hover:text-gray-800">
        Sign In
      </RouterLink>

      <span class="h-6 w-px bg-gray-200" aria-hidden="true"></span>

      <RouterLink :to="ROUTES.REGISTER" class="text-sm font-medium text-gray-700 hover:text-gray-800">
        Create Account
      </RouterLink>

    </template>

  </div>
</template>

<script setup>
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { ROUTES } from "@/config";
import { useAuth } from "@/composables/useAuth";
import { useAuthStore } from "@/stores/authStore";

const auth = useAuthStore();
const { handleLogout } = useAuth();

const loggingOut = ref(false);

async function logout() {
  loggingOut.value = true;

  try {
    await handleLogout();
  } finally {
    loggingOut.value = false;
  }
}
</script>
