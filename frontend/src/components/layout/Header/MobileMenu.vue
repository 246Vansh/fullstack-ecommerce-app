<template>
    <TransitionRoot as="template" :show="open">
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

                            <button type="button" class="rounded-md p-2 text-gray-400 hover:text-gray-500"
                                @click="closeMenu">
                                <span class="sr-only">Close menu</span>

                                <XMarkIcon class="h-6 w-6" />
                            </button>

                        </div>

                        <!-- Tabs -->
                        <TabGroup as="div" class="mt-2">

                            <div class="border-b border-gray-200">

                                <TabList class="-mb-px flex space-x-8 px-4">

                                    <Tab v-for="category in navigation.categories" :key="category.name"
                                        v-slot="{ selected }" as="template">

                                        <button :class="[
                                            selected
                                                ? 'border-indigo-600 text-indigo-600'
                                                : 'border-transparent text-gray-900',
                                            'flex-1 whitespace-nowrap border-b-2 px-1 py-4 text-base font-medium'
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

                                                <img :src="item.imageSrc" :alt="item.imageAlt"
                                                    class="h-full w-full object-cover object-center" />

                                            </div>

                                            <a :href="item.href" class="mt-4 block font-medium text-gray-900">

                                                <span class="absolute inset-0 z-10" aria-hidden="true"></span>

                                                {{ item.name }}

                                            </a>

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

                                                <a :href="item.href"
                                                    class="-m-2 block p-2 text-gray-500 hover:text-gray-800">
                                                    {{ item.name }}
                                                </a>

                                            </li>

                                        </ul>

                                    </div>

                                    <!-- Pages -->

                                    <div class="border-t border-gray-200 pt-6">

                                        <div v-for="page in navigation.pages" :key="page.name" class="flow-root">

                                            <a :href="page.href" class="-m-2 block p-2 font-medium text-gray-900">
                                                {{ page.name }}
                                            </a>

                                        </div>

                                    </div>

                                </TabPanel>

                            </TabPanels>

                        </TabGroup>

                        <!-- Account Links -->

                        <div class="space-y-6 border-t border-gray-200 px-4 py-6">

                            <div class="flow-root">

                                <RouterLink to="/login" class="-m-2 block p-2 font-medium text-gray-900 hover:text-indigo-600">
                                    Sign In
                                </RouterLink>

                            </div>

                            <div class="flow-root">

                                <RouterLink to="/SignIn"
                                    class="-m-2 block p-2 font-medium text-gray-900 hover:text-indigo-600">
                                    Create Account
                                </RouterLink>

                            </div>

                        </div>

                        <!-- Currency Selector -->

                        <div class="border-t border-gray-200 px-4 py-6">

                            <button class="-m-2 flex items-center rounded-md p-2 hover:bg-gray-50">

                                <img src="https://tailwindcss.com/plus-assets/img/flags/flag-canada.svg"
                                    alt="Canada Flag" class="block h-auto w-5 shrink-0" />

                                <span class="ml-3 text-base font-medium text-gray-900">
                                    CAD
                                </span>

                                <span class="sr-only">
                                    Change currency
                                </span>

                            </button>

                        </div>

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

import { XMarkIcon } from "@heroicons/vue/24/outline";

import { navigation } from "@/constants/navigation";

import { useMobileMenu } from "@/composables/useMobileMenu";

import {RouterLink} from "vue-router"

const {
    open,
    closeMenu
} = useMobileMenu();

</script>