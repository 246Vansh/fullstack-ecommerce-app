<template>
  <div class="ml-auto flex items-center">

    <!-- Authentication -->
    <AuthLinks />

    <!-- Currency -->
    <CurrencySelector />

    <!-- Search -->
    <SearchButton />

    <!-- Cart -->
    <CartButton />

  </div>
</template>

<script setup>
import AuthLinks from "./AuthLinks.vue";
import CurrencySelector from "./CurrencySelector.vue";
import SearchButton from "./SearchButton.vue";
import CartButton from "./CartButton.vue";
</script>