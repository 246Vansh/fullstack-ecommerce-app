<template>
  <div class="ml-auto flex items-center gap-1 sm:gap-1.5">

    <!-- No currency selector: each product, cart and order is shown in its own stored currency. -->

    <!-- Search -->
    <SearchButton />

    <!-- Notifications (signed in only) -->
    <NotificationBell v-if="auth.isAuthenticated" />

    <!-- Cart -->
    <CartButton />

    <!-- Account (desktop): profile menu or Sign In / Create Account, last so
         its dropdown opens at the right edge. On mobile it lives in the drawer. -->
    <AuthLinks />

  </div>
</template>

<script setup>
import AuthLinks from "./AuthLinks.vue";
import SearchButton from "./SearchButton.vue";
import CartButton from "./CartButton.vue";
import NotificationBell from "./NotificationBell.vue";
import { useAuthStore } from "@/stores/authStore";

const auth = useAuthStore();
</script>