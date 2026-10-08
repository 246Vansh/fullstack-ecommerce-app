<template>
    <form ref="formEl" class="grid gap-4 sm:grid-cols-2" novalidate @submit.prevent="submit">

        <label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Address Type
            <select v-model="form.type" name="type"
                class="rounded-xl border border-gray-200 px-4 py-3 font-normal text-slate-900 focus:border-indigo-500 focus:outline-none">
                <option v-for="option in TYPES" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
        </label>

        <div class="hidden sm:block" />

        <label v-for="field in FIELDS" :key="field.name" class="flex flex-col gap-1 text-sm font-medium text-slate-700"
            :class="{ 'sm:col-span-2': field.wide }">
            {{ field.label }}
            <input v-model="form[field.name]" :name="field.name" :autocomplete="field.autocomplete"
                :type="field.name === 'phone' ? 'tel' : 'text'" :required="REQUIRED.includes(field.name)"
                :aria-invalid="errors[field.name] ? 'true' : undefined"
                :aria-describedby="errors[field.name] ? `${uid}-${field.name}-error` : undefined"
                class="rounded-xl border px-4 py-3 font-normal text-slate-900 focus:border-indigo-500 focus:outline-none"
                :class="errors[field.name] ? 'border-red-400' : 'border-gray-200'" />
            <span v-if="errors[field.name]" :id="`${uid}-${field.name}-error`" class="text-xs font-normal text-red-600">{{ errors[field.name] }}</span>
        </label>

        <label class="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input v-model="form.isDefault" name="isDefault" type="checkbox" class="h-4 w-4 rounded border-gray-300" />
            Use as my default {{ typeLabel.toLowerCase() }} address
        </label>

        <p v-if="message" role="alert" class="text-sm font-medium text-red-600 sm:col-span-2">{{ message }}</p>

        <div class="flex gap-3 sm:col-span-2">
            <button type="submit" :disabled="saving"
                class="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">
                {{ saving ? "Saving..." : "Save Address" }}
            </button>
            <button type="button" :disabled="saving"
                class="rounded-xl border border-gray-200 px-6 py-3 font-semibold text-slate-700 transition hover:bg-gray-50 cursor-pointer"
                @click="$emit('cancel')">
                Cancel
            </button>
        </div>

    </form>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, useId } from "vue";

import { parseApiError } from "@/services/apiClient";

const props = defineProps({
    // Existing address to edit; omit to add a new one.
    address: {
        type: Object,
        default: null,
    },
    // (fields) => Promise; rejects with the API error.
    save: {
        type: Function,
        required: true,
    },
});

const emit = defineEmits(["saved", "cancel"]);

const TYPES = [
    { value: "HOME", label: "Home" },
    { value: "WORK", label: "Work" },
    { value: "OTHER", label: "Other" },
];

// Matches the Address model; the server validates everything again.
const FIELDS = [
    { name: "firstName", label: "First Name", autocomplete: "given-name" },
    { name: "lastName", label: "Last Name", autocomplete: "family-name" },
    { name: "phone", label: "Phone", autocomplete: "tel" },
    { name: "country", label: "Country", autocomplete: "country-name" },
    { name: "address", label: "Street Address", autocomplete: "address-line1", wide: true },
    { name: "apartment", label: "Apartment, suite, etc. (optional)", autocomplete: "address-line2", wide: true },
    { name: "city", label: "City", autocomplete: "address-level2" },
    { name: "state", label: "State", autocomplete: "address-level1" },
    { name: "zipCode", label: "ZIP Code", autocomplete: "postal-code" },
];

const REQUIRED = ["firstName", "lastName", "phone", "address", "city", "state", "zipCode", "country"];

const form = reactive({
    type: props.address?.type ?? "HOME",
    isDefault: props.address?.isDefault ?? false,
    ...Object.fromEntries(FIELDS.map(({ name }) => [name, props.address?.[name] ?? ""])),
});

const errors = reactive({});
const message = ref("");
const saving = ref(false);

const uid = useId();

const formEl = ref(null);

// Keyboard users land in the form when it opens, and on the first field to fix after a failed save.
onMounted(() => formEl.value?.querySelector("select, input")?.focus());

async function focusFirstError() {
    await nextTick();
    formEl.value?.querySelector("[aria-invalid='true']")?.focus();
}

const typeLabel = computed(() => TYPES.find((option) => option.value === form.type)?.label ?? "");

async function submit() {
    for (const key of Object.keys(errors)) delete errors[key];
    message.value = "";

    for (const name of REQUIRED) {
        if (!String(form[name]).trim()) errors[name] = "This field is required";
    }

    if (Object.keys(errors).length) {
        focusFirstError();
        return;
    }

    saving.value = true;

    try {
        emit("saved", await props.save({ ...form }));
    } catch (err) {
        const { message: text, fields } = parseApiError(err);

        Object.assign(errors, fields);
        message.value = Object.keys(fields).length ? "" : text;
        focusFirstError();
    } finally {
        saving.value = false;
    }
}
</script>
