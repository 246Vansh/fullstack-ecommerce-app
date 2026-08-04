<template>
  <div>

    <!-- Mobile Menu -->
    <MobileMenu />

    <!-- Header -->
    <header class="relative bg-white">

      <!-- Announcement Bar -->
      <p
        class="flex h-10 items-center justify-center bg-indigo-600 px-4 text-sm font-medium text-white sm:px-6 lg:px-8">
        Get free delivery on orders over $100
      </p>

      <!-- Navigation -->
      <nav aria-label="Top" class="mx-auto max-w-9xl px-4 sm:px-6 lg:px-8">
          <div class="flex h-16 items-center border-b border-gray-200">

            <!-- Mobile Menu Button -->
            <button type="button" class="relative rounded-md bg-white p-2 text-gray-400 lg:hidden" @click="openMenu">
              <span class="sr-only">
                Open menu
              </span>

              <Bars3Icon class="h-6 w-6" />
            </button>

            <!-- Logo -->
            <Logo />

            <!-- Navigation -->
            <DesktopNavigation />

            <!-- Right Side -->
            <HeaderActions />

          </div>
      </nav>

    </header>

    <!-- Hero -->

  </div>
</template>

<script setup>

import { Bars3Icon } from "@heroicons/vue/24/outline";

import Logo from "./Logo.vue";
import MobileMenu from "./MobileMenu.vue";
import HeaderActions from "./HeaderActions.vue";
import DesktopNavigation from "./DesktopNavigation.vue";
import { useMobileMenu } from "@/composables/useMobileMenu";

const {
  openMenu
} = useMobileMenu();

</script>