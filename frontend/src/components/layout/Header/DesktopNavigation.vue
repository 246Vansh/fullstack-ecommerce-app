<template>
    <PopoverGroup class="hidden lg:ml-8 lg:block lg:self-stretch">
        <div class="flex h-full space-x-8">

            <!-- Categories -->
            <Popover v-for="category in navigation.categories" :key="category.id" v-slot="{ open }" class="flex">
                <div class="relative flex">

                    <PopoverButton :class="[
                        open
                            ? 'text-indigo-600'
                            : 'text-gray-700 hover:text-gray-800',
                        'relative flex items-center justify-center text-sm font-medium transition-colors duration-200 ease-out '
                    ]">
                        {{ category.name }}

                        <span :class="[
                            open ? 'bg-indigo-600' : '',
                            'absolute inset-x-0 -bottom-px h-0.5 transition duration-200 ease-out'
                        ]" aria-hidden="true"></span>
                    </PopoverButton>

                </div>

                <MegaMenu :category="category" :open="open" />

            </Popover>

            <!-- Static Navigation Links -->
            <a v-for="page in navigation.pages" :key="page.name" :href="page.href"
                class="flex items-center text-sm font-medium text-gray-700 transition-colors duration-200 hover:text-gray-800">
                {{ page.name }}
            </a>

        </div>
    </PopoverGroup>
</template>

<script setup>
import {
    Popover,
    PopoverButton,
    PopoverGroup,
} from "@headlessui/vue";

import MegaMenu from "./MegaMenu.vue";
import { navigation } from "@/constants/navigation";
</script>