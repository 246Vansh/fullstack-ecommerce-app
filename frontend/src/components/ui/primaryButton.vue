<template>
    <!-- `to` renders a RouterLink for in-app navigation; `href` stays for plain anchors.
         One root element, so callers can focus it through ref.$el. -->
    <component :is="to ? RouterLink : tag" v-bind="elementAttrs" :class="buttonClasses">
        <LoadingSpinner v-if="loading" class="-ml-1" />
        <slot />
    </component>
</template>

<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";

import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";

// The store's one button. Every main action uses `primary`; `outline` (alias
// `secondary`), `light` and `ghost` are the quieter ones.
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
        default: "primary", // primary | secondary | outline | light | ghost | danger
    },
    size: {
        type: String,
        default: "md", // sm | md | lg
    },
    disabled: {
        type: Boolean,
        default: false,
    },
    // Shows a spinner, disables the button and sets aria-busy. The label is
    // the caller's (e.g. "Placing Order...").
    loading: {
        type: Boolean,
        default: false,
    },
    fullWidth: {
        type: Boolean,
        default: false,
    },
});

const outline = [
    "border",
    "border-slate-300",
    "bg-white",
    "text-slate-900",
    "hover:border-slate-400",
    "hover:bg-slate-50",
    "outline-accent",
];

const variantClasses = {
    primary: [
        "bg-primary",
        "text-white",
        "shadow-sm",
        "hover:bg-primary-hover",
        "outline-primary",
    ],
    secondary: outline,
    outline,
    light: [
        "bg-white",
        "text-slate-900",
        "shadow-sm",
        "hover:bg-slate-100",
        "outline-white",
    ],
    ghost: [
        "text-slate-700",
        "hover:bg-slate-100",
        "hover:text-slate-900",
        "outline-accent",
    ],
    danger: [
        "bg-red-600",
        "text-white",
        "shadow-sm",
        "hover:bg-red-700",
        "outline-red-600",
    ],
};

const sizeClasses = {
    sm: "min-h-9 px-4 text-sm",
    md: "min-h-11 px-6 text-sm",
    lg: "min-h-14 px-8 text-base",
};

const inactive = computed(() => props.disabled || props.loading);

// Only the attributes that apply to the rendered element: an explicit
// `href: undefined` would override the href RouterLink renders. A link
// cannot be disabled natively, so it is marked aria-disabled and taken out
// of the tab order instead.
const elementAttrs = computed(() => {
    const state = {
        "aria-busy": props.loading || undefined,
    };

    if (props.to || props.tag === "a") {
        const target = props.to ? { to: props.to } : { href: props.href };

        return inactive.value
            ? { ...target, ...state, "aria-disabled": "true", tabindex: "-1" }
            : { ...target, ...state };
    }

    return { type: props.type, disabled: inactive.value, ...state };
});

const buttonClasses = computed(() => [
    "inline-flex items-center justify-center gap-2 rounded-control",
    "font-semibold tracking-tight",
    "transition-colors duration-200",
    // Each variant sets its outline colour unconditionally (not only on
    // focus-visible), so transition-colors never animates it in from the text colour.
    "focus-visible:outline-2 focus-visible:outline-offset-2",
    sizeClasses[props.size],
    ...variantClasses[props.variant],
    props.fullWidth ? "w-full" : "",
    inactive.value
        ? "cursor-not-allowed opacity-50 pointer-events-none"
        : "cursor-pointer",
]);
</script>
