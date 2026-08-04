<template>
  <footer aria-labelledby="footer-heading" class="bg-white">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FooterLinks />

        <div class="grid gap-8 lg:grid-cols-2">

          <NewsletterCard />
          <PromotionCard />

        </div>
        <FooterBottom />
      </div>

  </footer>
</template>

<script setup>
import FooterLinks from "./FooterLinks.vue";
import NewsletterCard from "./NewsletterCard.vue";
import PromotionCard from "./PromotionCard.vue";
import FooterBottom from "./FooterBottom.vue";
</script>