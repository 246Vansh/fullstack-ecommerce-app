<template>
    <component :is="tag" :href="tag === 'a' ? href : undefined" :type="tag === 'button' ? type : undefined"
        :disabled="disabled" :class="buttonClasses">
        <slot />
    </component>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
    tag: {
        type: String,
        default: "a",
    },

    href: {
        type: String,
        default: "#",
    },

    type: {
        type: String,
        default: "button",
    },

    variant: {
        type: String,
        default: "primary", // primary | light | outline | danger
    },

    size: {
        type: String,
        default: "md", // sm | md | lg
    },

    disabled: {
        type: Boolean,
        default: false,
    },

    fullWidth: {
        type: Boolean,
        default: false,
    },
});

const variantClasses = {
    primary: [
        "bg-indigo-600",
        "text-white",
        "hover:bg-indigo-700",
        "focus:ring-indigo-500",
    ],

    light: [
        "bg-white",
        "text-gray-900",
        "hover:bg-gray-100",
        "focus:ring-gray-300",
    ],

    outline: [
        "border",
        "border-gray-300",
        "bg-white",
        "text-gray-700",
        "hover:bg-gray-50",
        "focus:ring-indigo-500",
    ],

    danger: [
        "bg-red-600",
        "text-white",
        "hover:bg-red-700",
        "focus:ring-red-500",
    ],
};

const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
};

const buttonClasses = computed(() => [
    "inline-flex items-center justify-center rounded-md",
    "font-semibold",
    "shadow-sm",
    "transition-colors duration-200",
    "focus:outline-none",
    "focus:ring-2",
    "focus:ring-offset-2",

    sizeClasses[props.size],
    ...variantClasses[props.variant],

    props.fullWidth ? "w-full" : "",

    props.disabled
        ? "cursor-not-allowed opacity-50 pointer-events-none"
        : "",
]);
</script>