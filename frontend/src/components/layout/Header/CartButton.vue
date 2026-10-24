<template>
  <div class="flex">

    <RouterLink to="/cart"
      class="group inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand">
      <ShoppingBagIcon class="size-6 shrink-0 text-slate-600 group-hover:text-slate-900" aria-hidden="true" />
      <span class="text-sm font-semibold tabular-nums text-slate-900">{{ cart.itemCount }}</span>
      <span class="sr-only">items in cart, view bag</span>
    </RouterLink>

  </div>
</template>

<script setup>
import { ShoppingBagIcon } from '@heroicons/vue/24/outline'
import { RouterLink } from 'vue-router';

import { useCartStore } from '@/stores/cartStore';

// Quantity-based count: the server cart when signed in, the guest cart otherwise.
const cart = useCartStore()
</script>