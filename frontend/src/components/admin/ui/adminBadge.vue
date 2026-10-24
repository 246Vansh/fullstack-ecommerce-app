<template>
    <!-- Status pill. The dot repeats the colour, so the text alone carries the meaning. -->
    <span class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset"
        :class="TONES[tone] ?? TONES.neutral">
        <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>
        <slot />
    </span>
</template>

<script setup>
defineProps({
    // success | neutral | warning | danger | info | brand
    tone: { type: String, default: "neutral" },
});

// Text colours are the 800 shades: at least 6.5:1 on their own tint.
const TONES = {
    success: "bg-green-50 text-green-800 ring-green-600/20",
    neutral: "bg-slate-100 text-slate-700 ring-slate-500/20",
    warning: "bg-amber-50 text-amber-800 ring-amber-600/25",
    danger: "bg-red-50 text-red-800 ring-red-600/20",
    info: "bg-sky-50 text-sky-800 ring-sky-600/20",
    brand: "bg-brand-soft text-brand ring-brand/20",
};
</script>
