<template>
    <!-- Label, hint and error for one control. The slot receives the ids and
         state to bind: <AdminField v-slot="field"><input :id="field.id" v-bind="field.attrs"></AdminField> -->
    <div :class="$attrs.class">
        <label :for="id" class="block text-sm font-medium text-slate-900">
            {{ label }}<span v-if="required" class="ml-0.5 text-red-700" aria-hidden="true">*</span>
            <span v-if="optional" class="font-normal text-slate-500"> (optional)</span>
        </label>
        <div class="mt-1.5">
            <slot :id="id" :attrs="attrs" :control-class="controlClass" />
        </div>
        <p v-if="hint && !error" :id="`${id}-hint`" class="mt-1.5 text-xs leading-5 text-slate-600">{{ hint }}</p>
        <p v-if="error" :id="`${id}-error`" class="mt-1.5 flex items-start gap-1 text-xs leading-5 font-medium text-red-700">
            <ExclamationCircleIcon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {{ error }}
        </p>
    </div>
</template>

<script setup>
import { computed } from "vue";
import { ExclamationCircleIcon } from "@heroicons/vue/20/solid";

defineOptions({ inheritAttrs: false });

const props = defineProps({
    id: { type: String, required: true },
    label: { type: String, required: true },
    hint: { type: String, default: "" },
    error: { type: String, default: "" },
    required: { type: Boolean, default: false },
    optional: { type: Boolean, default: false },
});

const attrs = computed(() => ({
    "aria-invalid": props.error ? "true" : undefined,
    "aria-describedby": props.error ? `${props.id}-error` : props.hint ? `${props.id}-hint` : undefined,
    "aria-required": props.required ? "true" : undefined,
}));

// Same look as the store's inputs (auth/fields/baseInput): 44px tall, and
// 16px text below sm so iOS does not zoom into the field.
const controlClass = computed(() => [
    "block min-h-11 w-full rounded-control border bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:outline-none focus:ring-3 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 sm:text-sm",
    props.error
        ? "border-red-600 focus:border-red-600 focus:ring-red-600/20"
        : "border-slate-300 hover:border-slate-400 focus:border-brand focus:ring-brand/20",
]);
</script>
