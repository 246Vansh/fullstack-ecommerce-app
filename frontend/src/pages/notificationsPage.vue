<template>

    <Header />

    <main id="main-content" tabindex="-1" class="bg-surface">

        <div class="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8">

            <header class="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                        Notifications
                    </h1>
                    <p class="mt-1 text-sm text-slate-600">
                        {{ notifications.unreadCount
                            ? `${notifications.unreadCount} unread`
                            : "Updates about your orders and payments" }}
                    </p>
                </div>

                <PrimaryButton v-if="notifications.items.length" tag="button" variant="outline" size="sm"
                    :disabled="!notifications.unreadCount" :loading="notifications.markingAll"
                    @click="notifications.markAllRead()">
                    <CheckIcon v-if="!notifications.markingAll" class="h-4 w-4" aria-hidden="true" />
                    Mark all as read
                </PrimaryButton>
            </header>

            <!-- Announces load results without moving focus -->
            <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>

            <p v-if="notifications.actionError" role="alert"
                class="mt-4 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {{ notifications.actionError }}
            </p>

            <!-- First load -->
            <section v-if="!notifications.pagination && !notifications.listError"
                class="mt-6 flex min-h-72 items-center justify-center rounded-panel border border-slate-200 bg-white">
                <LoadingSpinner class="text-brand" label="Loading notifications" />
            </section>

            <!-- Error (nothing loaded) -->
            <section v-else-if="!notifications.pagination"
                class="mt-6 flex min-h-72 flex-col items-center justify-center rounded-panel border border-slate-200 bg-white px-6 text-center">
                <ExclamationTriangleIcon class="h-8 w-8 text-slate-400" aria-hidden="true" />
                <h2 class="mt-4 text-xl font-semibold text-slate-900">Notifications unavailable</h2>
                <p class="mt-2 text-slate-600">{{ notifications.listError }}</p>
                <PrimaryButton tag="button" variant="outline" class="mt-6" :loading="notifications.loadingList"
                    @click="notifications.loadNotifications()">
                    Try again
                </PrimaryButton>
            </section>

            <!-- Empty -->
            <section v-else-if="!notifications.items.length"
                class="mt-6 flex min-h-72 flex-col items-center justify-center rounded-panel border border-slate-200 bg-white px-6 text-center">
                <span class="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <BellIcon class="size-6" aria-hidden="true" />
                </span>
                <h2 class="mt-4 text-xl font-semibold text-slate-900">No notifications yet</h2>
                <p class="mt-2 max-w-sm text-slate-600">
                    We'll let you know here when your orders are placed, paid, shipped and delivered.
                </p>
                <PrimaryButton :to="{ name: 'orders' }" variant="outline" class="mt-6">
                    View My Orders
                </PrimaryButton>
            </section>

            <!-- List, newest first -->
            <section v-else class="mt-6" aria-labelledby="notifications-heading">

                <h2 id="notifications-heading" class="sr-only">All notifications</h2>

                <ul role="list" class="divide-y divide-slate-100 overflow-hidden rounded-panel border border-slate-200 bg-white shadow-card">
                    <li v-for="notification in notifications.items" :key="notification.id"
                        class="flex gap-3 px-4 py-4 sm:gap-4 sm:px-5"
                        :class="{ 'bg-brand-soft/40': !notification.readAt }">

                        <span class="flex size-10 shrink-0 items-center justify-center rounded-full"
                            :class="notification.readAt ? 'bg-slate-100 text-slate-500' : 'bg-brand-soft text-brand'">
                            <component :is="notificationIcon(notification.type)" class="size-5" aria-hidden="true" />
                        </span>

                        <div class="min-w-0 flex-1">
                            <div class="flex items-start justify-between gap-3">
                                <h3 class="text-sm text-slate-900 sm:text-base"
                                    :class="notification.readAt ? 'font-medium' : 'font-semibold'">
                                    {{ notification.title }}
                                    <span v-if="!notification.readAt" class="sr-only">(unread)</span>
                                </h3>
                                <time class="shrink-0 pt-0.5 text-xs text-slate-500" :datetime="notification.createdAt"
                                    :title="formatFullTime(notification.createdAt)">
                                    {{ formatRelativeTime(notification.createdAt) }}
                                </time>
                            </div>

                            <p class="mt-1 text-sm wrap-anywhere text-slate-600">{{ notification.message }}</p>

                            <div v-if="notificationRoute(notification) || !notification.readAt"
                                class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                                <RouterLink v-if="notificationRoute(notification)" :to="notificationRoute(notification)"
                                    class="-mx-1 inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-brand"
                                    @click="notifications.markRead(notification.id)">
                                    View order
                                    <ChevronRightIcon class="h-4 w-4" aria-hidden="true" />
                                </RouterLink>
                                <button v-if="!notification.readAt" type="button"
                                    class="-mx-1 inline-flex min-h-9 items-center rounded-md px-1 text-sm font-medium text-slate-600 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
                                    @click="notifications.markRead(notification.id)">
                                    Mark as read
                                    <span class="sr-only">: {{ notification.title }}</span>
                                </button>
                            </div>
                        </div>

                        <span v-if="!notification.readAt" class="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true"></span>

                    </li>
                </ul>

                <!-- Load more (the list stays; a failure keeps what is shown) -->
                <div v-if="notifications.hasMore || notifications.listError" class="mt-6 flex flex-col items-center gap-2">
                    <p v-if="notifications.listError" class="text-sm text-red-700" role="alert">
                        {{ notifications.listError }}
                    </p>
                    <PrimaryButton tag="button" variant="outline" :loading="notifications.loadingList"
                        @click="notifications.loadNotifications({ more: true })">
                        {{ notifications.listError ? "Try again" : "Load more" }}
                    </PrimaryButton>
                </div>

                <p class="mt-4 text-center text-xs text-slate-500">
                    Showing {{ notifications.items.length }} of {{ notifications.pagination.total }}
                </p>

            </section>

        </div>

    </main>

    <Footer />

</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { BellIcon, CheckIcon, ChevronRightIcon, ExclamationTriangleIcon } from "@heroicons/vue/24/outline";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";

import { useNotificationStore } from "@/stores/notificationStore";
import {
    formatFullTime,
    formatRelativeTime,
    notificationIcon,
    notificationRoute,
} from "@/utils/notifications";

const notifications = useNotificationStore();

// The route requires sign-in, so the store already knows the user here.
// Always the first page on arrival: the list may have changed since.
notifications.loadNotifications();

const liveMessage = computed(() => {
    if (notifications.loadingList) return "Loading notifications";
    if (notifications.listError) return `Notifications unavailable. ${notifications.listError}`;
    if (!notifications.pagination) return "";
    if (!notifications.items.length) return "No notifications yet";
    return `Showing ${notifications.items.length} of ${notifications.pagination.total} notifications`;
});
</script>
