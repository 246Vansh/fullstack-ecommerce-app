<template>
  <!-- Sticky on the wrapper (a direct child of #app) so it stays up for the whole page.
       z-30: above page content and the catalog toolbar (z-20), below the drawers
       (z-40, portaled to <body>). The mega menu and search panel stack inside it. -->
  <div class="sticky top-0 z-30">

    <!-- Mobile Menu -->
    <MobileMenu />

    <!-- Header -->
    <header class="relative border-b border-slate-200/80 bg-white/90 backdrop-blur-md">

      <!-- Navigation -->
      <nav aria-label="Top" class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div class="flex h-16 items-center gap-2 lg:gap-0">

            <!-- Mobile Menu Button -->
            <button id="mobile-menu-button" type="button"
              class="relative -ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand lg:hidden cursor-pointer"
              aria-haspopup="dialog" :aria-expanded="open" @click="openMenu">
              <span class="sr-only">
                Open menu
              </span>

              <Bars3Icon class="h-6 w-6" aria-hidden="true" />

              <!-- Unread notifications, where the header bell is hidden (under 360px).
                   The menu's Notifications link carries the count for screen readers. -->
              <span v-if="notifications.unreadCount"
                class="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-brand ring-2 ring-white min-[360px]:hidden"
                aria-hidden="true"></span>
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
import { useNotificationStore } from "@/stores/notificationStore";

const {
  open,
  openMenu
} = useMobileMenu();

// Signed out, the count is always 0 (the store resets with the user).
const notifications = useNotificationStore();

</script>