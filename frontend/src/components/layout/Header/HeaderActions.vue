<template>
  <div class="ml-auto flex items-center">

    <!-- Authentication -->
    <AuthLinks />

    <!-- Prices and orders are USD only; there is no currency selector. -->

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