<template>

    <div v-if="badge" class="pointer-events-none absolute left-0 top-0 z-20 h-[92px] w-[92px] overflow-hidden">

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

const badgeClasses = computed(() => [
    "absolute",
    "left-[-27px]",
    "top-[17px]",
    "flex",
    "w-[115px]",
    "-rotate-45",
    "items-center",
    "justify-center",
    "gap-1",
    "py-2",
    "text-[10px]",
    "font-black",
    "uppercase",
    "tracking-[0.1em]",
    "leading-none",
    "whitespace-nowrap",
    "border-y",
    "border-white/30",
    "shadow-[0_4px_12px_rgba(15,23,42,0.18)]",
    "transition-all",
    "duration-300",
    "group-hover:translate-x-0.5",
    "group-hover:shadow-[0_7px_18px_rgba(15,23,42,0.22)]",
    props.badge?.background,
    props.badge?.text,
]);

</script>