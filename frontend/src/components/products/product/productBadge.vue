<template>

    <!-- max-w leaves room for the wishlist heart in the top-right corner. -->
    <div v-if="badge" class="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-4.25rem)]">

        <div :class="badgeClasses">

            <component v-if="badge.icon" :is="badge.icon" class="h-3.5 w-3.5" />

            <span>
                {{ badge.name }}
            </span>

        </div>

    </div>

</template>

<script setup>

import { computed } from "vue";

const props = defineProps({

    badge: {

        type: Object,

        default: null,

        validator(value) {

            if (value === null) return true;

            return (
                "id" in value &&
                "name" in value &&
                "background" in value &&
                "text" in value
            );

        },

    },

});

// A small pill over the photo's corner; colors come from constants/catalog/badges.js.
const badgeClasses = computed(() => [
    "inline-flex",
    "items-center",
    "gap-1",
    "rounded-full",
    "px-2.5",
    "py-1",
    "text-xs",
    "font-semibold",
    "leading-none",
    "whitespace-nowrap",
    "shadow-sm",
    props.badge?.background,
    props.badge?.text,
]);

</script>