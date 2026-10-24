<template>
    <!-- z-20: above product cards, below the sticky header (z-30); on mobile it has no wrapper. -->
    <Menu as="div" class="relative z-20 inline-block text-left">

        <!-- Button ("Sort by:" stays in the accessible name on every screen size) -->

        <MenuButton
            class="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 transition-colors duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand cursor-pointer">
            <ArrowsUpDownIcon class="h-4 w-4 text-slate-400 sm:hidden" aria-hidden="true" />

            <span class="sr-only sm:not-sr-only">
                Sort by:
            </span>

            <span class="font-semibold text-slate-900">
                {{ selectedOption?.label }}
            </span>

            <ChevronDownIcon class="h-5 w-5 text-slate-400" aria-hidden="true" />
        </MenuButton>

        <!-- Dropdown -->

        <transition enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">

            <MenuItems
                class="absolute right-0 z-20 mt-2 w-60 origin-top-right rounded-card bg-white p-1.5 shadow-raised ring-1 ring-slate-900/5 focus:outline-none">

                <MenuItem v-for="option in options" :key="option.id" v-slot="{ active }">
                    <button type="button" @click="selectedSort = option.value" :class="[
                        active
                            ? 'bg-slate-100'
                            : '',

                        selectedSort === option.value
                            ? 'font-semibold text-slate-900'
                            : 'text-slate-700',

                        'flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-sm transition-colors cursor-pointer'
                    ]">
                        {{ option.label }}

                        <CheckIcon v-if="selectedSort === option.value" class="h-5 w-5 text-brand" aria-hidden="true" />
                        <span v-if="selectedSort === option.value" class="sr-only">(selected)</span>
                    </button>

                </MenuItem>

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
    ArrowsUpDownIcon,
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
