<template>
  <div class="ml-auto flex items-center">

    <!-- Authentication -->
    <AuthLinks />

    <!-- No currency selector: each product, cart and order is shown in its own stored currency. -->

    <!-- Search -->
    <SearchButton />

    <!-- Cart -->
    <CartButton />

  </div>
</template>

<script setup>
import AuthLinks from "./AuthLinks.vue";
import SearchButton from "./SearchButton.vue";
import CartButton from "./CartButton.vue";
</script>