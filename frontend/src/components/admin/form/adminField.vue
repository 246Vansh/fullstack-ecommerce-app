<template>
    <!-- Label, hint and error for one control. The slot receives the ids and
         state to bind: <AdminField v-slot="field"><input :id="field.id" v-bind="field.attrs"></AdminField> -->
    <div :class="$attrs.class">
        <label :for="id" class="block text-sm font-medium text-slate-700">
            {{ label }}<span v-if="required" class="ml-0.5 text-red-600" aria-hidden="true">*</span>
            <span v-if="optional" class="font-normal text-slate-400"> (optional)</span>
        </label>
        <div class="mt-1">
            <slot :id="id" :attrs="attrs" :control-class="controlClass" />
        </div>
        <p v-if="hint && !error" :id="`${id}-hint`" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
        <p v-if="error" :id="`${id}-error`" class="mt-1 text-xs font-medium text-red-700">{{ error }}</p>
    </div>
</template>

<script setup>
import { computed } from "vue";

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

const controlClass = computed(() => [
    "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 disabled:bg-slate-100 disabled:text-slate-500",
    props.error ? "border-red-500 focus:outline-red-600" : "border-slate-300 focus:border-indigo-600 focus:outline-indigo-600",
]);
</script>
