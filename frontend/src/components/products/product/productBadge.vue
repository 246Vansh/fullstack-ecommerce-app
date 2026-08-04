<template>
    <span v-if="badge" :class="badgeClasses">
        {{ badge.name }}
    </span>
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
                "backgroundClass" in value &&
                "textClass" in value
            );

        },
    },
});

const badgeClasses = computed(() => [

    "absolute",
    "left-4",
    "top-4",
    "z-20",
    "rounded-full",
    "px-3",
    "py-1",
    "text-xs",
    "font-semibold",
    "uppercase",
    "tracking-wide",

    props.badge?.backgroundClass,

    props.badge?.textClass,

]);

</script>