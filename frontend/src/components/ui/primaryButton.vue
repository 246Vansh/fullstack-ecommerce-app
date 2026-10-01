<template>
    <!-- `to` renders a RouterLink for in-app navigation; `href` stays for plain anchors. -->
    <component :is="to ? RouterLink : tag" v-bind="elementAttrs" :class="buttonClasses">
        <slot />
    </component>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

const props = defineProps({
    tag: {
        type: String,
        default: "a",
    },

    href: {
        type: String,
        default: "#",
    },

    to: {
        type: [String, Object],
        default: null,
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

// Only the attributes that apply to the rendered element: an explicit
// `href: undefined` would override the href RouterLink renders.
const elementAttrs = computed(() => {
    if (props.to) return { to: props.to };

    return props.tag === "a"
        ? { href: props.href, disabled: props.disabled }
        : { type: props.type, disabled: props.disabled };
});

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