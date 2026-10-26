<template>
  <!-- Below sm the panel is positioned against the <header> (full width with
       gutters, like the search panel); from sm it hangs under the bell.
       Under 360px the header has no room for it: the mobile menu links to
       the notifications page instead, and its button shows an unread dot. -->
  <div ref="root" class="hidden min-[360px]:flex sm:relative" @keydown.esc="close(true)" @focusout="onFocusOut">

    <button ref="toggleButton" type="button"
      class="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
      :aria-expanded="open" aria-controls="notifications-panel" @click="toggle">
      <span class="sr-only">{{ buttonLabel }}</span>
      <BellIcon class="size-6" aria-hidden="true" />
      <span v-if="notifications.unreadCount"
        class="absolute top-1 right-0.5 min-w-5 rounded-full bg-brand px-1 text-center text-[11px] leading-5 font-semibold text-white tabular-nums ring-2 ring-white"
        aria-hidden="true">
        {{ badge }}
      </span>
    </button>

    <div v-if="open" id="notifications-panel" role="region" aria-labelledby="notifications-panel-title"
      class="absolute inset-x-4 top-full z-30 mt-2 overflow-hidden rounded-card border border-slate-200 bg-white shadow-raised sm:inset-x-auto sm:right-0 sm:w-96">

      <div class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 id="notifications-panel-title" class="text-sm font-semibold text-slate-900">
          Notifications
        </h2>
        <button v-if="notifications.unreadCount && notifications.recent.length" type="button"
          :disabled="notifications.markingAll"
          class="-my-1 inline-flex min-h-9 items-center rounded-md px-2 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50 cursor-pointer"
          @click="notifications.markAllRead()">
          {{ notifications.markingAll ? "Marking…" : "Mark all as read" }}
        </button>
      </div>

      <p v-if="notifications.actionError" class="border-b border-slate-100 bg-red-50 px-4 py-2 text-xs text-red-700" role="alert">
        {{ notifications.actionError }}
      </p>

      <!-- First load -->
      <div v-if="!notifications.recentLoaded && !notifications.recentError" class="flex min-h-40 items-center justify-center">
        <LoadingSpinner class="text-brand" label="Loading notifications" />
      </div>

      <!-- Error (nothing loaded yet) -->
      <div v-else-if="!notifications.recentLoaded" class="flex min-h-40 flex-col items-center justify-center px-6 py-6 text-center">
        <p class="text-sm text-slate-600">{{ notifications.recentError }}</p>
        <button type="button" :disabled="notifications.loadingRecent"
          class="mt-3 inline-flex min-h-9 items-center rounded-md px-3 text-sm font-semibold text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50 cursor-pointer"
          @click="notifications.fetchRecent()">
          Try again
        </button>
      </div>

      <!-- Empty -->
      <div v-else-if="!notifications.recent.length" class="flex min-h-40 flex-col items-center justify-center px-6 py-8 text-center">
        <span class="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand">
          <BellIcon class="size-5" aria-hidden="true" />
        </span>
        <p class="mt-3 text-sm font-semibold text-slate-900">You're all caught up</p>
        <p class="mt-1 text-sm text-slate-500">Updates about your orders will appear here.</p>
      </div>

      <!-- Latest notifications -->
      <ul v-else role="list" class="max-h-[min(26rem,60vh)] divide-y divide-slate-100 overflow-y-auto">
        <li v-for="notification in notifications.recent" :key="notification.id">
          <button type="button"
            class="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand cursor-pointer"
            :class="{ 'bg-brand-soft/50': !notification.readAt }" @click="openNotification(notification)">

            <span class="flex size-9 shrink-0 items-center justify-center rounded-full"
              :class="notification.readAt ? 'bg-slate-100 text-slate-500' : 'bg-brand-soft text-brand'">
              <component :is="notificationIcon(notification.type)" class="size-5" aria-hidden="true" />
            </span>

            <span class="min-w-0 flex-1">
              <span class="block text-sm text-slate-900" :class="notification.readAt ? 'font-medium' : 'font-semibold'">
                {{ notification.title }}
                <span v-if="!notification.readAt" class="sr-only">(unread)</span>
              </span>
              <span class="mt-0.5 line-clamp-2 block text-sm wrap-anywhere text-slate-600">{{ notification.message }}</span>
              <time class="mt-1 block text-xs text-slate-500" :datetime="notification.createdAt"
                :title="formatFullTime(notification.createdAt)">
                {{ formatRelativeTime(notification.createdAt) }}
              </time>
            </span>

            <span v-if="!notification.readAt" class="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true"></span>
          </button>
        </li>
      </ul>

      <div class="border-t border-slate-100 p-2">
        <RouterLink :to="{ name: 'notifications' }"
          class="flex min-h-10 items-center justify-center rounded-control text-sm font-semibold text-brand transition-colors hover:bg-brand-soft hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-brand">
          View all notifications
        </RouterLink>
      </div>

    </div>

  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { BellIcon } from "@heroicons/vue/24/outline";

import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import { useNotificationStore } from "@/stores/notificationStore";
import {
  formatFullTime,
  formatRelativeTime,
  formatUnreadBadge,
  notificationIcon,
  notificationRoute,
} from "@/utils/notifications";

const notifications = useNotificationStore();
const route = useRoute();
const router = useRouter();

const open = ref(false);
const root = ref(null);
const toggleButton = ref(null);

const badge = computed(() => formatUnreadBadge(notifications.unreadCount));

const buttonLabel = computed(() => {
  const count = notifications.unreadCount;
  return count ? `Notifications, ${count} unread` : "Notifications";
});

// Every open shows the latest list (the count may have moved since).
function toggle() {
  open.value = !open.value;

  if (open.value) notifications.fetchRecent();
}

// Focus inside the panel would be lost when it unmounts, so it goes back to
// the bell (as in SearchButton); after a navigation the new page takes it.
function close(returnFocus = false) {
  if (!open.value) return;

  if (returnFocus || root.value?.contains(document.activeElement)) toggleButton.value?.focus();

  open.value = false;
}

// Tabbing out of the bell and panel closes it.
function onFocusOut(event) {
  if (event.relatedTarget && !root.value?.contains(event.relatedTarget)) open.value = false;
}

function onPointerDown(event) {
  if (!root.value?.contains(event.target)) open.value = false;
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener("pointerdown", onPointerDown);
  else document.removeEventListener("pointerdown", onPointerDown);
});

onBeforeUnmount(() => document.removeEventListener("pointerdown", onPointerDown));

// Any navigation closes the panel.
watch(() => route.fullPath, () => {
  open.value = false;
});

// Marks it read (without waiting) and opens its order, if it has one.
function openNotification(notification) {
  notifications.markRead(notification.id);

  const target = notificationRoute(notification);

  if (target) {
    open.value = false;
    router.push(target);
  }
}
</script>
