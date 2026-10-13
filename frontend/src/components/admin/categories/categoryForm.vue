<template>
    <form ref="formEl" novalidate class="space-y-4" :aria-label="category ? `Edit ${category.name}` : 'New category'"
        @submit.prevent="submit">
        <AdminFormStatus :alert="save.alert.value" />

        <div class="grid gap-4 sm:grid-cols-2">
            <AdminField :id="`${prefix}-name`" label="Name" required :error="save.errors.name" v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.name" type="text" :maxlength="LIMITS.categoryName"
                    autocomplete="off" :class="f.controlClass" />
            </AdminField>

            <AdminField :id="`${prefix}-slug`" label="Slug" :required="Boolean(category)" :optional="!category"
                :error="save.errors.slug" :hint="category ? 'Used in store links and filters.' : 'Leave blank to generate it from the name.'" v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.slug" type="text" :maxlength="LIMITS.categorySlug"
                    autocomplete="off" spellcheck="false" :placeholder="category ? '' : slugify(form.name)"
                    :class="[f.controlClass, 'font-mono']" />
            </AdminField>

            <AdminField :id="`${prefix}-parent`" label="Parent category" :error="save.errors.parentId"
                :hint="parentHint" v-slot="f">
                <select :id="f.id" v-bind="f.attrs" v-model="form.parentId" :disabled="hasChildren" :class="f.controlClass">
                    <option value="">None (top-level)</option>
                    <option v-for="parent in parents" :key="parent.id" :value="String(parent.id)">
                        {{ parent.name }}{{ parent.isActive ? "" : " (inactive)" }}
                    </option>
                </select>
            </AdminField>

            <AdminField :id="`${prefix}-image`" label="Image URL" optional :error="save.errors.image" v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.image" type="url" inputmode="url"
                    :maxlength="LIMITS.url" autocomplete="off" spellcheck="false" placeholder="https://" :class="f.controlClass" />
            </AdminField>

            <AdminField :id="`${prefix}-description`" label="Description" optional :error="save.errors.description"
                class="sm:col-span-2" v-slot="f">
                <textarea :id="f.id" v-bind="f.attrs" v-model="form.description" rows="3" :maxlength="LIMITS.text"
                    :class="f.controlClass"></textarea>
            </AdminField>

            <div class="sm:col-span-2">
                <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input v-model="form.isActive" type="checkbox" :aria-describedby="`${prefix}-active-hint`"
                        class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-600" />
                    Active (shown in the store)
                </label>
                <p :id="`${prefix}-active-hint`" class="mt-1 text-xs text-slate-500">
                    A category can only be deactivated once it has no active products or active subcategories.
                    <span v-if="save.errors.isActive" class="block font-medium text-red-700">{{ save.errors.isActive }}</span>
                </p>
            </div>
        </div>

        <div class="flex gap-2">
            <button type="submit" :disabled="save.saving.value"
                class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 cursor-pointer">
                {{ save.saving.value ? "Saving…" : category ? "Save category" : "Create category" }}
            </button>
            <button type="button" :disabled="save.saving.value"
                class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer"
                @click="cancel">
                Cancel
            </button>
        </div>
    </form>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";

import AdminField from "@/components/admin/form/adminField.vue";
import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import { adminCatalogService } from "@/services/adminCatalogService";
import { useAdminSave } from "@/composables/useAdminSave";
import { useFocusFirstError } from "@/composables/useFocusFirstError";
import {
    LIMITS, categoryErrors, categoryFormFrom, categoryPayload, changedFields, emptyCategoryForm, hasErrors, slugify,
} from "@/utils/adminCatalogRules";

const props = defineProps({
    // The category being edited; null for a new one.
    category: { type: Object, default: null },
    categories: { type: Array, required: true },
});

const emit = defineEmits(["saved", "cancel", "dirty"]);

const prefix = props.category ? `category-${props.category.id}` : "new-category";
const save = useAdminSave();
const formEl = ref(null);

const initial = () => (props.category ? categoryFormFrom(props.category) : emptyCategoryForm());
const form = reactive(initial());
const baseline = categoryPayload(initial());

// Two levels only: a parent must be top-level, and not this category.
const parents = computed(() => props.categories
    .filter((category) => category.parentId === null && category.id !== props.category?.id)
    .sort((a, b) => a.name.localeCompare(b.name)));

const hasChildren = computed(() => (props.category?.childCount ?? 0) > 0);
const parentHint = computed(() => (hasChildren.value
    ? "It has subcategories, so it must stay top-level."
    : "Subcategories cannot have their own subcategories."));

const dirty = computed(() => Object.keys(changedFields(categoryPayload(form), baseline)).length > 0);
watch(dirty, (value) => emit("dirty", value), { immediate: true });

useFocusFirstError(formEl, () => save.errors);

const isField = (key) => key in form;

async function submit() {
    const errors = categoryErrors(form, { slugRequired: Boolean(props.category) });
    if (hasErrors(errors)) return save.rejectLocally(errors);

    const payload = categoryPayload(form, { create: !props.category });
    const body = props.category ? changedFields(payload, baseline) : payload;

    if (props.category && !Object.keys(body).length) return emit("cancel");

    const saved = await save.run(
        () => (props.category ? adminCatalogService.updateCategory(props.category.id, body) : adminCatalogService.createCategory(body)),
        { isField },
    );

    if (saved) emit("saved", saved);
}

function cancel() {
    if (dirty.value && !window.confirm("Discard the changes to this category?")) return;
    emit("cancel");
}

defineExpose({ focus: () => formEl.value?.querySelector("input")?.focus() });
</script>
