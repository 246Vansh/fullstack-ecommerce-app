<template>
    <div class="min-h-screen bg-surface">

        <!-- Mobile navigation drawer -->
        <TransitionRoot as="template" :show="menuOpen" @after-leave="afterLeave">
            <Dialog class="relative z-40 lg:hidden" @close="menuOpen = false">

                <TransitionChild as="template" enter="transition-opacity ease-linear duration-200" enter-from="opacity-0"
                    enter-to="opacity-100" leave="transition-opacity ease-linear duration-200" leave-from="opacity-100"
                    leave-to="opacity-0">
                    <div class="fixed inset-0 bg-slate-900/40"></div>
                </TransitionChild>

                <div class="fixed inset-0 z-40 flex">
                    <TransitionChild as="template" enter="transition ease-in-out duration-200 transform"
                        enter-from="-translate-x-full" enter-to="translate-x-0"
                        leave="transition ease-in-out duration-200 transform" leave-from="translate-x-0"
                        leave-to="-translate-x-full">
                        <DialogPanel class="relative flex h-full w-full max-w-xs flex-col bg-white shadow-raised">

                            <div class="flex h-16 items-center justify-between border-b border-slate-200 px-4">
                                <DialogTitle class="flex items-center gap-2 text-base font-semibold text-slate-900">
                                    {{ APP_CONFIG.appName }}
                                    <span class="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">Admin</span>
                                </DialogTitle>
                                <button type="button"
                                    class="flex h-11 w-11 items-center justify-center rounded-control text-slate-500 hover:bg-slate-100 hover:text-slate-700 outline-brand focus-visible:outline-2 cursor-pointer"
                                    @click="menuOpen = false">
                                    <span class="sr-only">Close menu</span>
                                    <XMarkIcon class="h-6 w-6" aria-hidden="true" />
                                </button>
                            </div>

                            <AdminNav nav-id="admin-menu" class="flex-1 overflow-y-auto px-3 py-5" @navigate="menuOpen = false" />

                            <AccountCard class="border-t border-slate-200 p-4" />

                        </DialogPanel>
                    </TransitionChild>
                </div>

            </Dialog>
        </TransitionRoot>

        <!-- Desktop sidebar -->
        <aside class="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-slate-200 bg-white">
            <div class="flex h-16 shrink-0 items-center border-b border-slate-200 px-5">
                <RouterLink :to="{ name: 'admin-products' }"
                    class="flex items-center gap-2 rounded-md text-lg font-bold tracking-tight text-brand outline-brand focus-visible:outline-2 focus-visible:outline-offset-2">
                    {{ APP_CONFIG.appName }}
                    <span class="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">Admin</span>
                </RouterLink>
            </div>
            <AdminNav class="flex-1 overflow-y-auto px-3 py-6" />
            <AccountCard class="border-t border-slate-200 p-4" />
        </aside>

        <div class="lg:pl-64">

            <!-- Header -->
            <header class="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">

                <button id="admin-menu-button" type="button"
                    class="-ml-2 flex h-11 w-11 items-center justify-center rounded-control text-slate-600 hover:bg-slate-100 hover:text-slate-900 outline-brand focus-visible:outline-2 lg:hidden cursor-pointer"
                    aria-controls="admin-menu" :aria-expanded="menuOpen" @click="menuOpen = true">
                    <span class="sr-only">Open admin menu</span>
                    <Bars3Icon class="h-6 w-6" aria-hidden="true" />
                </button>

                <span class="flex min-w-0 items-center gap-2 font-semibold tracking-tight text-slate-900 lg:hidden">
                    <span class="truncate">{{ APP_CONFIG.appName }}</span>
                    <span class="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">Admin</span>
                </span>

                <div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">

                    <RouterLink :to="ROUTES.HOME"
                        class="inline-flex min-h-11 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 outline-brand focus-visible:outline-2">
                        <BuildingStorefrontIcon class="h-5 w-5" aria-hidden="true" />
                        <span class="hidden sm:inline">View store</span>
                        <span class="sr-only sm:hidden">View store</span>
                    </RouterLink>

                    <button type="button" :disabled="loggingOut"
                        class="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 outline-brand focus-visible:outline-2 disabled:opacity-50 cursor-pointer"
                        @click="logout">
                        <ArrowRightStartOnRectangleIcon class="h-5 w-5" aria-hidden="true" />
                        <span>{{ loggingOut ? "Logging out…" : "Logout" }}</span>
                    </button>

                </div>
            </header>

            <main id="main-content" tabindex="-1" class="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <!-- Keyed by path: another product's edit page is a fresh page (its own
                     drafts and load), while list filters (query only) keep the page. -->
                <RouterView :key="route.path" />
            </main>

        </div>

    </div>
</template>

<script setup>
import { h, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from "@headlessui/vue";
import {
    ArrowRightStartOnRectangleIcon,
    Bars3Icon,
    BuildingStorefrontIcon,
    XMarkIcon,
} from "@heroicons/vue/24/outline";

import AdminNav from "./adminNav.vue";
import { APP_CONFIG, ROUTES } from "@/config";
import { useAuth } from "@/composables/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { restoreFocusAfterDialog } from "@/router/pageFocus";

const auth = useAuthStore();
const { handleLogout } = useAuth();
const route = useRoute();

const menuOpen = ref(false);

// A nav link closes the drawer and moves to a new page, which takes focus;
// otherwise focus returns to the menu button.
let pathAtOpen = route.path;
watch(menuOpen, (open) => { if (open) pathAtOpen = route.path; });
const afterLeave = () => restoreFocusAfterDialog("admin-menu-button", route.path !== pathAtOpen);

// Signed-in admin, at the foot of the sidebar and the drawer.
const AccountCard = () => (auth.user
    ? h("div", { class: "flex min-w-0 items-center gap-3" }, [
        h("span", {
            class: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white",
            "aria-hidden": "true",
        }, initials(auth.user)),
        h("p", { class: "min-w-0 text-sm" }, [
            h("span", { class: "block truncate font-medium text-slate-900" }, `${auth.user.firstName} ${auth.user.lastName}`),
            h("span", { class: "block truncate text-slate-500" }, auth.user.email),
        ]),
    ])
    : null);

const initials = (user) => `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "A";

const loggingOut = ref(false);

async function logout() {
    loggingOut.value = true;

    try {
        await handleLogout();
    } finally {
        loggingOut.value = false;
    }
}
</script>
