<template>
    <Menu as="div" class="relative inline-block text-left">

        <!-- Button -->

        <MenuButton
            class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-600">
            <span>
                Sort by:
            </span>

            <span class="font-semibold text-gray-900">
                {{ selectedOption?.label }}
            </span>

            <ChevronDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
        </MenuButton>

        <!-- Dropdown -->

        <transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">

            <MenuItems
                class="absolute right-0 z-20 mt-2 w-64 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
                <div class="py-2">

                    <MenuItem v-for="option in options" :key="option.id" v-slot="{ active }">
                        <button type="button" @click="selectedSort = option.value" :class="[
                            active
                                ? 'bg-gray-100'
                                : '',

                            'flex w-full items-center justify-between px-4 py-2 text-sm text-gray-700 transition-colors'
                        ]">
                            {{ option.label }}

                            <CheckIcon v-if="selectedSort === option.value" class="h-5 w-5 text-indigo-600" />
                        </button>

                    </MenuItem>

                </div>

            </MenuItems>

        </transition>

    </Menu>
</template>

<script setup>
import { computed } from "vue";

import {
    Menu,
    MenuButton,
    MenuItem,
    MenuItems,
} from "@headlessui/vue";

import {
    ChevronDownIcon,
} from "@heroicons/vue/20/solid";

import {
    CheckIcon,
} from "@heroicons/vue/24/solid";

const props = defineProps({

    options: {
        type: Array,
        default: () => [],
    },

});

const selectedSort = defineModel({
    type: String,
    default: "newest",
});

const selectedOption = computed(() => {

    return props.options.find(

        option => option.value === selectedSort.value

    );

});
</script>