<template>
  <div class="ml-auto flex items-center gap-1 sm:gap-2">

    <!-- Authentication -->
    <AuthLinks />

    <!-- No currency selector: each product, cart and order is shown in its own stored currency. -->

    <!-- Search -->
    <SearchButton />

    <!-- Notifications (signed in only) -->
    <NotificationBell v-if="auth.isAuthenticated" />

    <!-- Cart -->
    <CartButton />

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