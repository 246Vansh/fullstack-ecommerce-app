<template>
    <div class="relative">

        <!-- aria-pressed carries the state; the label names the action. -->
        <button type="button" :aria-pressed="saved" :aria-label="saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`"
            :title="saved ? 'Remove from wishlist' : 'Save to wishlist'" :aria-busy="busy"
            class="flex cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait"
            :class="overlay
                ? 'group/heart h-9 w-9 rounded-full bg-white/90 shadow-md ring-1 ring-slate-900/10 backdrop-blur-sm transition duration-200 ease-out hover:bg-white motion-safe:hover:scale-105 sm:h-10 sm:w-10'
                : 'h-full min-h-12 w-14 rounded-control border border-slate-300 bg-white transition-colors hover:border-slate-400'"
            :disabled="busy" @click.prevent.stop="onClick">
            <HeartSolidIcon v-if="saved" class="h-5 w-5 text-red-600" aria-hidden="true" />
            <HeartIcon v-else class="h-5 w-5 text-slate-700 transition-colors duration-200"
                :class="overlay ? 'group-hover/heart:text-brand' : ''" aria-hidden="true" />
        </button>

        <p v-if="failure" role="alert"
            class="absolute top-full right-0 z-20 mt-2 w-52 rounded-control bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-lg">
            {{ failure }}
        </p>

    </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { HeartIcon } from "@heroicons/vue/24/outline";
import { HeartIcon as HeartSolidIcon } from "@heroicons/vue/24/solid";

import { useAuthStore } from "@/stores/authStore";
import { useWishlistStore } from "@/stores/wishlistStore";

const props = defineProps({
    productId: {
        type: Number,
        required: true,
    },
    // For the accessible label.
    name: {
        type: String,
        default: "this product",
    },
    // Round button over a product image (cards), or a bordered square next
    // to Add to Cart (product page).
    overlay: {
        type: Boolean,
        default: false,
    },
});

const auth = useAuthStore();
const wishlist = useWishlistStore();
const route = useRoute();
const router = useRouter();

const saved = computed(() => wishlist.has(props.productId));
const busy = computed(() => wishlist.isPending(props.productId));
const failure = computed(() => (wishlist.actionError?.productId === props.productId ? wishlist.actionError.message : ""));

// Guests sign in first and come back here, the same way protected pages do.
function onClick() {
    if (!auth.isAuthenticated) {
        router.push({ name: "login", query: { redirect: route.fullPath } });
        return;
    }

    wishlist.toggle(props.productId);
}
</script>
