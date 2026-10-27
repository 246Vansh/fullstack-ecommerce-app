<template>
    <TransitionRoot as="template" :show="open" @after-leave="afterLeave">
        <Dialog class="relative z-40 lg:hidden" @close="closeMenu">

            <!-- Backdrop -->
            <TransitionChild as="template" enter="transition-opacity ease-linear duration-300" enter-from="opacity-0"
                enter-to="opacity-100" leave="transition-opacity ease-linear duration-300" leave-from="opacity-100"
                leave-to="opacity-0">
                <div class="fixed inset-0 bg-black/25"></div>
            </TransitionChild>

            <!-- Drawer -->
            <div class="fixed inset-0 z-40 flex">

                <TransitionChild as="template" enter="transition ease-in-out duration-300 transform"
                    enter-from="-translate-x-full" enter-to="translate-x-0"
                    leave="transition ease-in-out duration-300 transform" leave-from="translate-x-0"
                    leave-to="-translate-x-full">
                    <DialogPanel
                        class="relative flex w-full max-w-xs flex-col overflow-y-auto bg-white shadow-xl pb-12">

                        <!-- Header -->
                        <div class="flex items-center justify-between px-4 pt-5 pb-2">

                            <h2 class="text-lg font-semibold text-gray-900">
                                Menu
                            </h2>

                            <button type="button"
                                class="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
                                @click="closeMenu">
                                <span class="sr-only">Close menu</span>

                                <XMarkIcon class="h-6 w-6" aria-hidden="true" />
                            </button>

                        </div>

                        <!-- Shopping -->
                        <h3 class="mt-2 px-4 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Shopping
                        </h3>

                        <TabGroup as="div" class="mt-1">

                            <div class="border-b border-gray-200">

                                <TabList class="-mb-px flex space-x-8 px-4">

                                    <Tab v-for="category in navigation.categories" :key="category.name"
                                        v-slot="{ selected }" as="template">

                                        <button :class="[
                                            selected
                                                ? 'border-brand text-brand'
                                                : 'border-transparent text-slate-900 hover:text-brand',
                                            'flex-1 whitespace-nowrap border-b-2 px-1 py-4 text-base font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand'
                                        ]">
                                            {{ category.name }}
                                        </button>

                                    </Tab>

                                </TabList>

                            </div>

                            <!-- Panels -->
                            <TabPanels>

                                <TabPanel v-for="category in navigation.categories" :key="category.name"
                                    class="space-y-10 px-4 pt-10 pb-8">

                                    <!-- Featured Products -->

                                    <div class="grid grid-cols-2 gap-x-4">

                                        <div v-for="item in category.featured" :key="item.name"
                                            class="group relative text-sm">

                                            <div
                                                class="aspect-square overflow-hidden rounded-lg bg-gray-100 group-hover:opacity-75">

                                                <img :src="item.imageSrc" alt=""
                                                    class="h-full w-full object-cover object-center" />

                                            </div>

                                            <RouterLink :to="item.to" class="mt-4 block font-medium text-gray-900"
                                                @click="closeMenu">

                                                <span class="absolute inset-0 z-10" aria-hidden="true"></span>

                                                {{ item.name }}

                                            </RouterLink>

                                            <p class="mt-1">
                                                Shop now
                                            </p>

                                        </div>

                                    </div>

                                    <!-- Sections -->

                                    <div v-for="section in category.sections" :key="section.name">

                                        <p :id="`${section.name}-heading-mobile`" class="font-medium text-gray-900">
                                            {{ section.name }}
                                        </p>

                                        <ul role="list" :aria-labelledby="`${section.name}-heading-mobile`"
                                            class="mt-6 flex flex-col space-y-6">

                                            <li v-for="item in section.items" :key="item.name" class="flow-root">

                                                <RouterLink :to="item.to"
                                                    class="-m-2 block rounded-md p-2 text-slate-600 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                                                    @click="closeMenu">
                                                    {{ item.name }}
                                                </RouterLink>

                                            </li>

                                        </ul>

                                    </div>

                                </TabPanel>

                            </TabPanels>

                        </TabGroup>

                        <!-- My Account -->

                        <section class="border-t border-gray-200 px-4 py-6" aria-labelledby="mobile-account-heading">

                            <h3 id="mobile-account-heading" class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                My Account
                            </h3>

                            <template v-if="auth.isAuthenticated">

                                <div class="mt-3 flex items-center gap-3 rounded-card bg-slate-50 px-3 py-3">
                                    <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-semibold text-brand" aria-hidden="true">
                                        {{ initial }}
                                    </span>
                                    <div class="min-w-0">
                                        <p class="truncate text-sm font-semibold text-slate-900">
                                            <span class="sr-only">Signed in as </span>{{ fullName }}
                                        </p>
                                        <p v-if="auth.user.email" class="truncate text-xs text-slate-500">{{ auth.user.email }}</p>
                                    </div>
                                </div>

                                <ul role="list" class="mt-3 space-y-1">

                                    <li v-for="link in accountLinks" :key="link.to">
                                        <RouterLink :to="link.to" :class="rowClass" @click="closeMenu">
                                            <component :is="link.icon" class="size-5 shrink-0 text-slate-400 group-hover:text-brand group-aria-[current=page]:text-brand" aria-hidden="true" />
                                            <span class="flex-1">{{ link.label }}</span>
                                            <span v-if="link.badge" :class="link.badgeClass">
                                                {{ link.badge }}
                                                <span class="sr-only">{{ link.badgeLabel }}</span>
                                            </span>
                                        </RouterLink>
                                    </li>

                                </ul>

                                <div class="my-3 h-px bg-slate-100" aria-hidden="true"></div>

                                <button type="button" :disabled="loggingOut"
                                    class="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer disabled:cursor-wait disabled:opacity-50"
                                    @click="logout">
                                    <ArrowRightStartOnRectangleIcon class="size-5 shrink-0 text-slate-400" aria-hidden="true" />
                                    {{ loggingOut ? "Logging out…" : "Logout" }}
                                </button>

                            </template>

                            <!-- Guest -->
                            <div v-else class="mt-4 grid gap-3">

                                <RouterLink :to="ROUTES.LOGIN"
                                    class="flex min-h-11 items-center justify-center rounded-control bg-brand px-4 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                                    @click="closeMenu">
                                    Sign In
                                </RouterLink>

                                <RouterLink :to="ROUTES.REGISTER"
                                    class="flex min-h-11 items-center justify-center rounded-control border border-slate-300 bg-white px-4 font-semibold text-slate-900 transition-colors hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                                    @click="closeMenu">
                                    Create Account
                                </RouterLink>

                            </div>

                        </section>

                        <!-- Admin: a convenience link only; the API checks the ADMIN role on every /api/admin request. -->

                        <section v-if="auth.isAdmin" class="border-t border-gray-200 px-4 py-6" aria-labelledby="mobile-admin-heading">

                            <h3 id="mobile-admin-heading" class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                Admin
                            </h3>

                            <RouterLink :to="ROUTES.ADMIN" :class="[rowClass, 'mt-3']" @click="closeMenu">
                                <Cog6ToothIcon class="size-5 shrink-0 text-slate-400 group-hover:text-brand group-aria-[current=page]:text-brand" aria-hidden="true" />
                                <span class="flex-1">Admin dashboard</span>
                                <span class="rounded-full bg-brand-soft px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-brand uppercase">Admin</span>
                            </RouterLink>

                        </section>

                    </DialogPanel>

                </TransitionChild>

            </div>

        </Dialog>
    </TransitionRoot>
</template>

<script setup>

import {
    Dialog,
    DialogPanel,
    TransitionChild,
    TransitionRoot,
    Tab,
    TabGroup,
    TabList,
    TabPanel,
    TabPanels
} from "@headlessui/vue";

import {
    ArrowRightStartOnRectangleIcon,
    BellIcon,
    Cog6ToothIcon,
    HeartIcon,
    ShoppingBagIcon,
    UserCircleIcon,
    XMarkIcon,
} from "@heroicons/vue/24/outline";

import { navigation } from "@/constants/navigation";

import { useMobileMenu } from "@/composables/useMobileMenu";

import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import { ROUTES } from "@/config";
import { useAuth } from "@/composables/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import { formatUnreadBadge } from "@/utils/notifications";
import { restoreFocusAfterDialog } from "@/router/pageFocus";

const {
    open,
    closeMenu
} = useMobileMenu();

const auth = useAuthStore();
const notifications = useNotificationStore();
const wishlist = useWishlistStore();

const initial = computed(() => auth.user?.firstName?.trim().charAt(0).toUpperCase() || "?");
const fullName = computed(() => [auth.user?.firstName, auth.user?.lastName].filter(Boolean).join(" "));

// Same pages and icons as the desktop profile menu, plus Notifications
// (on desktop that is the header bell).
const accountLinks = computed(() => [
    {
        to: ROUTES.NOTIFICATIONS, label: "Notifications", icon: BellIcon,
        badge: notifications.unreadCount ? formatUnreadBadge(notifications.unreadCount) : "",
        badgeLabel: "unread",
        badgeClass: "min-w-6 rounded-full bg-brand px-2 py-0.5 text-center text-xs font-semibold text-white tabular-nums",
    },
    { to: ROUTES.ORDERS, label: "My Orders", icon: ShoppingBagIcon },
    {
        to: ROUTES.WISHLIST, label: "Wishlist", icon: HeartIcon,
        badge: wishlist.loaded && wishlist.ids.size ? String(wishlist.ids.size) : "",
        badgeLabel: "saved",
        badgeClass: "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 tabular-nums",
    },
    { to: ROUTES.ACCOUNT, label: "Account Settings", icon: UserCircleIcon },
]);

const rowClass = "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand aria-[current=page]:bg-brand-soft/60 aria-[current=page]:text-brand";

// A menu link navigates and closes the menu; focus then belongs to the new page.
const route = useRoute();
let pathAtOpen = route.path;
watch(open, (isOpen) => { if (isOpen) pathAtOpen = route.path; });

const afterLeave = () => restoreFocusAfterDialog("mobile-menu-button", route.path !== pathAtOpen);
const { handleLogout } = useAuth();

const loggingOut = ref(false);

async function logout() {
    loggingOut.value = true;

    try {
        await handleLogout();
        closeMenu();
    } finally {
        loggingOut.value = false;
    }
}

</script>