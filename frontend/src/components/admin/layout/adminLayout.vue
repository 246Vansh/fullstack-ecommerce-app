<template>
    <div class="min-h-screen bg-slate-50">

        <!-- Mobile navigation drawer -->
        <TransitionRoot as="template" :show="menuOpen" @after-leave="afterLeave">
            <Dialog class="relative z-40 lg:hidden" @close="menuOpen = false">

                <TransitionChild as="template" enter="transition-opacity ease-linear duration-200" enter-from="opacity-0"
                    enter-to="opacity-100" leave="transition-opacity ease-linear duration-200" leave-from="opacity-100"
                    leave-to="opacity-0">
                    <div class="fixed inset-0 bg-black/25"></div>
                </TransitionChild>

                <div class="fixed inset-0 z-40 flex">
                    <TransitionChild as="template" enter="transition ease-in-out duration-200 transform"
                        enter-from="-translate-x-full" enter-to="translate-x-0"
                        leave="transition ease-in-out duration-200 transform" leave-from="translate-x-0"
                        leave-to="-translate-x-full">
                        <DialogPanel class="relative flex h-full w-full max-w-xs flex-col bg-white shadow-xl">

                            <div class="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                                <DialogTitle class="text-lg font-semibold text-slate-900">Admin menu</DialogTitle>
                                <button type="button"
                                    class="rounded-md p-2 text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer"
                                    @click="menuOpen = false">
                                    <span class="sr-only">Close menu</span>
                                    <XMarkIcon class="h-6 w-6" aria-hidden="true" />
                                </button>
                            </div>

                            <AdminNav nav-id="admin-menu" class="flex-1 overflow-y-auto p-4" @navigate="menuOpen = false" />

                        </DialogPanel>
                    </TransitionChild>
                </div>

            </Dialog>
        </TransitionRoot>

        <!-- Desktop sidebar -->
        <aside class="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col border-r border-slate-200 bg-white">
            <div class="flex h-16 items-center border-b border-slate-200 px-6">
                <RouterLink :to="{ name: 'admin-products' }"
                    class="rounded text-lg font-extrabold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
                    {{ APP_CONFIG.appName }} <span class="font-semibold text-indigo-600">Admin</span>
                </RouterLink>
            </div>
            <AdminNav class="flex-1 overflow-y-auto p-4" />
        </aside>

        <div class="lg:pl-64">

            <!-- Header -->
            <header class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">

                <button id="admin-menu-button" type="button"
                    class="-ml-2 rounded-md p-2 text-slate-500 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-indigo-600 lg:hidden cursor-pointer"
                    aria-controls="admin-menu" :aria-expanded="menuOpen" @click="menuOpen = true">
                    <span class="sr-only">Open admin menu</span>
                    <Bars3Icon class="h-6 w-6" aria-hidden="true" />
                </button>

                <span class="font-extrabold tracking-tight text-slate-900 lg:hidden">
                    Admin
                </span>

                <div class="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">

                    <p v-if="auth.user" class="hidden min-w-0 text-right text-sm sm:block">
                        <span class="block truncate font-medium text-slate-900">
                            {{ auth.user.firstName }} {{ auth.user.lastName }}
                        </span>
                        <span class="block truncate text-slate-500">{{ auth.user.email }}</span>
                    </p>

                    <RouterLink :to="ROUTES.HOME"
                        class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600">
                        <BuildingStorefrontIcon class="h-5 w-5" aria-hidden="true" />
                        <span class="hidden sm:inline">View store</span>
                        <span class="sr-only sm:hidden">View store</span>
                    </RouterLink>

                    <button type="button" :disabled="loggingOut"
                        class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 cursor-pointer"
                        @click="logout">
                        <ArrowRightStartOnRectangleIcon class="h-5 w-5" aria-hidden="true" />
                        <span>{{ loggingOut ? "Logging out…" : "Logout" }}</span>
                    </button>

                </div>
            </header>

            <main id="main-content" tabindex="-1" class="px-4 py-6 sm:px-6 lg:px-8">
                <!-- Keyed by path: another product's edit page is a fresh page (its own
                     drafts and load), while list filters (query only) keep the page. -->
                <RouterView :key="route.path" />
            </main>

        </div>

    </div>
</template>

<script setup>
import { ref, watch } from "vue";
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
