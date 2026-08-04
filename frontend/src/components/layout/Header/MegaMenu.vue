<template>
  <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0" leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-2">
    <PopoverPanel class="absolute inset-x-0 top-full z-20 bg-white text-sm text-gray-500 shadow-lg">
      <!-- Shadow -->
      <div class="absolute inset-0 top-1/2 bg-white shadow-sm" aria-hidden="true"></div>

      <div class="relative bg-white">

        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div class="grid grid-cols-2 gap-x-8 gap-y-10 py-16">

            <!-- Featured Products -->

            <div class="col-start-2 grid grid-cols-2 gap-x-8">

              <div v-for="item in category.featured" :key="item.name" class="group relative text-base sm:text-sm">

                <div class="overflow-hidden rounded-lg bg-gray-100">

                  <img :src="item.imageSrc" :alt="item.imageAlt"
                    class="aspect-square w-full object-cover transition duration-300 group-hover:scale-105 group-hover:opacity-75" />

                </div>

                <a :href="item.href" class="mt-6 block font-medium text-gray-900">
                  <span class="absolute inset-0 z-10" aria-hidden="true"></span>

                  {{ item.name }}

                </a>

                <p class="mt-1 text-gray-500">
                  Shop now
                </p>

              </div>

            </div>

            <!-- Category Sections -->

            <div class="row-start-1 grid grid-cols-3 gap-x-8 gap-y-10 text-sm">

              <div v-for="section in category.sections" :key="section.name">

                <p :id="`${section.name}-heading`" class="font-semibold text-gray-900">
                  {{ section.name }}
                </p>

                <ul role="list" :aria-labelledby="`${section.name}-heading`"
                  class="mt-6 space-y-6 sm:mt-4 sm:space-y-4">

                  <li v-for="item in section.items" :key="item.name">

                    <a :href="item.href" class="transition hover:text-gray-900">
                      {{ item.name }}
                    </a>

                  </li>

                </ul>

              </div>

            </div>

          </div>

        </div>

      </div>

      <!-- Bottom Border -->

      <div class="absolute inset-0 top-0 mx-auto h-px max-w-7xl px-8">

        <div :class="[
          open ? 'bg-gray-200' : 'bg-transparent',
          'h-px w-full transition-colors duration-200'
        ]"></div>

      </div>

    </PopoverPanel>
  </transition>
</template>

<script setup>

import { PopoverPanel } from "@headlessui/vue";

defineProps({

  category: {
    type: Object,
    required: true,
  },

  open: {
    type: Boolean,
    required: true,
  },

});

</script>