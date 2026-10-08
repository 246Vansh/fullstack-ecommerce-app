<template>
  <footer aria-labelledby="footer-heading" class="bg-white">
    <h2 id="footer-heading" class="sr-only">Footer</h2>
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FooterLinks />
        <FooterBottom />
      </div>

  </footer>
</template>

<script setup>
import FooterLinks from "./FooterLinks.vue";
import FooterBottom from "./FooterBottom.vue";
</script>