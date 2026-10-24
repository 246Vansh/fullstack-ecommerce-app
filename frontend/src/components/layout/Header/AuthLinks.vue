<template>
  <div class="hidden lg:flex lg:items-center lg:space-x-5">

    <!-- Signed in -->
    <template v-if="auth.isAuthenticated">

      <span class="text-sm text-slate-500">
        Hi, {{ auth.user.firstName }}
      </span>

      <span class="h-5 w-px bg-slate-200" aria-hidden="true"></span>

      <RouterLink :to="ROUTES.ORDERS" class="rounded-md py-2 text-sm font-medium text-slate-700 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        Orders
      </RouterLink>

      <span class="h-5 w-px bg-slate-200" aria-hidden="true"></span>

      <RouterLink :to="ROUTES.ACCOUNT" class="rounded-md py-2 text-sm font-medium text-slate-700 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        Account
      </RouterLink>

      <template v-if="auth.isAdmin">
        <span class="h-5 w-px bg-slate-200" aria-hidden="true"></span>

        <RouterLink :to="ROUTES.ADMIN" class="rounded-md py-2 text-sm font-medium text-slate-700 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          Admin
        </RouterLink>
      </template>

      <span class="h-5 w-px bg-slate-200" aria-hidden="true"></span>

      <button type="button" :disabled="loggingOut"
        class="rounded-md py-2 text-sm font-medium text-slate-700 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer disabled:opacity-50"
        @click="logout">
        Logout
      </button>

    </template>

    <!-- Guest -->
    <template v-else>

      <RouterLink :to="ROUTES.LOGIN" class="rounded-md py-2 text-sm font-medium text-slate-700 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        Sign In
      </RouterLink>

      <span class="h-5 w-px bg-slate-200" aria-hidden="true"></span>

      <RouterLink :to="ROUTES.REGISTER" class="rounded-md py-2 text-sm font-medium text-slate-700 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
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
