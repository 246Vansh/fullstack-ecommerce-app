<template>
  <div class="ml-4 flow-root lg:ml-6">

    <RouterLink to="/cart" class="group -m-2 flex items-center p-2">
      <ShoppingBagIcon class="size-6 shrink-0 text-gray-400 group-hover:text-gray-500" aria-hidden="true" />
      <span class="ml-2 text-sm font-medium text-gray-700 group-hover:text-gray-800">{{ cart.itemCount }}</span>
      <span class="sr-only">items in cart, view bag</span>
    </RouterLink>

  </div>
</template>

<script setup>
import { ShoppingBagIcon } from '@heroicons/vue/24/outline'
import { RouterLink } from 'vue-router';

import { useCartStore } from '@/stores/cartStore';

// Server item count for signed-in users; 0 for guests.
const cart = useCartStore()
</script>