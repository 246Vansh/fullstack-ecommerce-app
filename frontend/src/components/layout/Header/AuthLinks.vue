<template>
  <div class="hidden lg:ml-2 lg:flex lg:items-center lg:gap-4 lg:border-l lg:border-slate-200 lg:pl-3">

    <!-- The left border divides the account group from the search/bell/cart icons. -->

    <!-- Signed in: one profile menu instead of a row of links, so new account
         pages are added to PROFILE_LINKS rather than to the header bar.
         Headless UI's Menu handles arrow keys, Escape, outside clicks and
         returning focus to the button. -->
    <Menu v-if="auth.isAuthenticated" v-slot="{ open }" as="div" class="relative">

      <MenuButton
        class="flex h-10 max-w-44 items-center gap-2 rounded-full py-1 pr-2.5 pl-1 text-sm font-medium ring-1 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer"
        :class="open ? 'bg-slate-50 text-slate-900 ring-slate-300' : 'text-slate-700 ring-slate-200'">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand" aria-hidden="true">
          {{ initial }}
        </span>
        <span class="truncate">{{ auth.user.firstName }}</span>
        <span class="sr-only">, account menu</span>
        <ChevronDownIcon class="size-4 shrink-0 text-slate-400 transition-transform duration-200" :class="{ 'rotate-180': open }" aria-hidden="true" />
      </MenuButton>

      <transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 motion-safe:-translate-y-1"
        enter-to-class="opacity-100" leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100"
        leave-to-class="opacity-0">

        <!-- Right edge lines up with the trigger's; z-30 keeps it above page content.
             Fixed 260px, never wider than the viewport minus the page gutters. -->
        <MenuItems
          class="absolute right-0 top-full z-30 mt-1.5 w-[260px] max-w-[calc(100vw-2rem)] origin-top-right rounded-lg border border-slate-200 bg-white p-1 shadow-md shadow-slate-900/5 focus:outline-none">

          <!-- Who is signed in (not a menu item, so arrow keys skip it). -->
          <div class="flex items-center gap-2.5 px-2.5 py-2">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand" aria-hidden="true">
              {{ initial }}
            </span>
            <div class="min-w-0 leading-tight">
              <p class="truncate text-[0.9375rem] font-semibold text-slate-900">{{ fullName }}</p>
              <p v-if="auth.user.email" class="mt-0.5 truncate text-xs text-slate-500">{{ auth.user.email }}</p>
            </div>
          </div>

          <!-- Groups are separated by spacing; the only line sits above Logout. -->
          <div class="mt-0.5">
            <MenuItem v-for="link in PROFILE_LINKS" :key="link.to" v-slot="{ active }">
              <RouterLink :to="link.to" :class="[itemClass(active), 'aria-[current=page]:text-brand']">
                <component :is="link.icon" class="size-[1.125rem] shrink-0" :class="iconClass(active)" aria-hidden="true" />
                <span class="flex-1 truncate">{{ link.label }}</span>
                <span v-if="link.count?.()" class="text-xs font-medium text-slate-400 tabular-nums">
                  {{ link.count() }}
                  <span class="sr-only">saved</span>
                </span>
              </RouterLink>
            </MenuItem>
          </div>

          <!-- Shown to admins only as a convenience; the API checks the ADMIN
               role on every /api/admin request whatever the UI shows. -->
          <div v-if="auth.isAdmin" class="mt-1.5">
            <MenuItem v-slot="{ active }">
              <RouterLink :to="ROUTES.ADMIN" :class="[itemClass(active), 'aria-[current=page]:text-brand']">
                <Cog6ToothIcon class="size-[1.125rem] shrink-0" :class="iconClass(active)" aria-hidden="true" />
                <span class="flex-1 truncate">Admin dashboard</span>
                <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide text-slate-500 uppercase" aria-hidden="true">Admin</span>
              </RouterLink>
            </MenuItem>
          </div>

          <div class="mt-1.5 border-t border-slate-100 pt-1">
            <MenuItem v-slot="{ active }" :disabled="loggingOut">
              <button type="button"
                :class="['flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm font-medium transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-50',
                  active ? 'bg-slate-50 text-red-600' : 'text-slate-700']"
                @click="logout">
                <ArrowRightStartOnRectangleIcon class="size-[1.125rem] shrink-0" :class="active ? 'text-red-600' : 'text-slate-400'" aria-hidden="true" />
                {{ loggingOut ? "Logging out…" : "Logout" }}
              </button>
            </MenuItem>
          </div>

        </MenuItems>

      </transition>

    </Menu>

    <!-- Guest -->
    <template v-else>

      <RouterLink :to="ROUTES.LOGIN" class="rounded-md py-2 text-sm font-medium text-slate-700 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        Sign In
      </RouterLink>

      <span class="h-5 w-px bg-slate-200" aria-hidden="true"></span>

      <RouterLink :to="ROUTES.REGISTER" class="rounded-md py-2 text-sm font-medium text-slate-700 transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        Create Account
      </RouterLink>

    </template>

  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  HeartIcon,
  ShoppingBagIcon,
  UserCircleIcon,
} from "@heroicons/vue/24/outline";

import { ROUTES } from "@/config";
import { useAuth } from "@/composables/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { useWishlistStore } from "@/stores/wishlistStore";

const auth = useAuthStore();
const wishlist = useWishlistStore();
const { handleLogout } = useAuth();

// Account pages in the profile menu, in order. Notifications stay as the
// header bell (a primary utility with its own unread badge). `count` is an
// optional number, shown only once it is known.
const PROFILE_LINKS = [
  { to: ROUTES.ORDERS, label: "My Orders", icon: ShoppingBagIcon },
  { to: ROUTES.WISHLIST, label: "Wishlist", icon: HeartIcon, count: () => (wishlist.loaded ? wishlist.ids.size : 0) },
  { to: ROUTES.ACCOUNT, label: "Account Settings", icon: UserCircleIcon },
];

const loggingOut = ref(false);

const initial = computed(() => auth.user?.firstName?.trim().charAt(0).toUpperCase() || "?");
const fullName = computed(() => [auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(" "));

// `active` is the item under the pointer or keyboard focus. Every row is the
// same height with the icon in the same column.
const itemClass = (active) => [
  "flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors cursor-pointer",
  active ? "bg-slate-50 text-slate-900" : "text-slate-700",
];

const iconClass = (active) => (active ? "text-brand" : "text-slate-400");

async function logout() {
  if (loggingOut.value) return;

  loggingOut.value = true;

  try {
    await handleLogout();
  } finally {
    loggingOut.value = false;
  }
}
</script>
