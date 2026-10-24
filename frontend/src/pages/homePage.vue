<script setup>
import Header from "../components/layout/Header/Header.vue";
import Hero from "../components/home/hero/heroSection.vue"
import Category from "../components/home/category/categorySection.vue"
import Featured from "../components/home/featured/featuredSection.vue"
import Favorites from "../components/home/favorites/favoritesSection.vue"
import Footer from "../components/layout/Footer/Footer.vue"

</script>

<template>
    <Header />
    <main id="main-content" tabindex="-1">
        <Hero />
        <!-- Real products straight after the hero; then departments; the
             catalog band shares the categories' warm background. -->
        <Favorites />
        <Category />
        <Featured />
    </main>
    <Footer />
</template>