<template>
    <div class="mx-auto max-w-5xl">

        <AdminPageHeader title="Categories"
            description="Two levels: top-level categories and their subcategories. Categories are deactivated, never deleted.">
            <template v-if="state === 'ready' && !creating" #actions>
                <PrimaryButton id="new-category-button" tag="button" class="w-full sm:w-auto" @click="openCreate">
                    <PlusIcon class="-ml-1 h-5 w-5" aria-hidden="true" />
                    New category
                </PrimaryButton>
            </template>
        </AdminPageHeader>

        <p class="sr-only" aria-live="polite">{{ announcement }}</p>

        <AdminStatePanel v-if="state === 'loading'" kind="loading" class="mt-6" title="Loading categories" />

        <AdminStatePanel v-else-if="state === 'forbidden'" kind="forbidden" class="mt-6" title="Admin access required"
            message="The server did not accept your account as an administrator. Sign out and sign in again if your access changed." />

        <AdminStatePanel v-else-if="state === 'error'" kind="error" class="mt-6" title="Categories unavailable" :message="loadError">
            <PrimaryButton tag="button" variant="outline" @click="load">Try again</PrimaryButton>
        </AdminStatePanel>

        <template v-else>
            <section v-if="creating" aria-labelledby="new-category-heading"
                class="mt-6 rounded-card border border-brand/25 bg-white p-4 shadow-card sm:p-6">
                <AdminSectionHeading heading-id="new-category-heading" title="New category"
                    text="Choose a parent to make it a subcategory." />
                <CategoryForm ref="createForm" class="mt-5" :categories="categories" @saved="created" @cancel="closeCreate"
                    @dirty="setDirty('new', $event)" />
            </section>

            <AdminStatePanel v-if="!categories.length" kind="empty" class="mt-6" :icon="FolderIcon" title="No categories yet"
                message="Create a top-level category first; products need one." />

            <template v-else>
                <p class="mt-6 mb-3 text-sm text-slate-600">{{ summary }}</p>

                <ul class="space-y-2" aria-label="Categories">
                    <li v-for="category in ordered" :key="category.id" class="relative"
                        :class="category.parentId ? 'pl-6 sm:pl-10' : ''">
                        <!-- Tree line to the parent (decorative; the sr-only text says it). -->
                        <span v-if="category.parentId" class="absolute left-2.5 top-0 h-8 w-3 rounded-bl-md border-b-2 border-l-2 border-slate-200 sm:left-5"
                            aria-hidden="true"></span>

                        <div class="rounded-control border shadow-card"
                            :class="category.isActive ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50'">
                            <div class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
                                <div class="flex min-w-0 flex-1 items-center gap-3">
                                    <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-control"
                                        :class="category.parentId ? 'bg-slate-100 text-slate-500' : 'bg-brand-soft text-brand'" aria-hidden="true">
                                        <component :is="category.parentId ? TagIcon : FolderIcon" class="h-5 w-5" />
                                    </span>
                                    <div class="min-w-0">
                                        <p class="wrap-anywhere font-semibold text-slate-900">
                                            <span v-if="category.parentId" class="sr-only">Subcategory of {{ nameOf(category.parentId) }}: </span>
                                            {{ category.name }}
                                        </p>
                                        <p class="wrap-anywhere text-sm text-slate-600">
                                            <span class="font-mono text-xs text-slate-500">{{ category.slug }}</span>
                                            · {{ category.productCount }} {{ category.productCount === 1 ? "product" : "products" }}
                                            <template v-if="!category.parentId">· {{ category.childCount }} {{ category.childCount === 1 ? "subcategory" : "subcategories" }}</template>
                                        </p>
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                                    <AdminBadge :tone="category.isActive ? 'success' : 'neutral'" class="mr-auto sm:mr-1">
                                        {{ category.isActive ? "Active" : "Inactive" }}
                                    </AdminBadge>
                                    <button :id="`category-${category.id}-edit`" type="button" :aria-expanded="editingId === category.id"
                                        :aria-controls="`category-${category.id}-panel`" :class="buttonClass" @click="openEdit(category)">
                                        Edit<span class="sr-only"> {{ category.name }}</span>
                                    </button>
                                    <button type="button" :disabled="statusSave.saving.value"
                                        :class="category.isActive ? dangerClass : buttonClass" @click="toggleActive(category)">
                                        {{ category.isActive ? "Deactivate" : "Activate" }}<span class="sr-only"> {{ category.name }}</span>
                                    </button>
                                </div>
                            </div>

                            <div v-if="statusFor === category.id && (statusSave.alert.value || statusSave.success.value)" class="px-3 pb-3 sm:px-4 sm:pb-4">
                                <AdminFormStatus :alert="statusSave.alert.value" :success="statusSave.success.value" />
                            </div>

                            <div v-if="editingId === category.id" :id="`category-${category.id}-panel`"
                                class="border-t border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                                <CategoryForm ref="editForm" :category="category" :categories="categories"
                                    @saved="updated" @cancel="closeEdit" @dirty="setDirty(category.id, $event)" />
                            </div>
                        </div>
                    </li>
                </ul>
            </template>
        </template>
    </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from "vue";
import { PlusIcon } from "@heroicons/vue/20/solid";
import { FolderIcon, TagIcon } from "@heroicons/vue/24/outline";

import AdminBadge from "@/components/admin/ui/adminBadge.vue";
import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import AdminPageHeader from "@/components/admin/ui/adminPageHeader.vue";
import AdminSectionHeading from "@/components/admin/ui/adminSectionHeading.vue";
import AdminStatePanel from "@/components/admin/ui/adminStatePanel.vue";
import CategoryForm from "@/components/admin/categories/categoryForm.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import { adminCatalogService } from "@/services/adminCatalogService";
import { parseApiError } from "@/services/apiClient";
import { useAdminSave } from "@/composables/useAdminSave";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";

// PrimaryButton size="sm" outline / danger-outline; plain buttons keep the ids used for focus return.
const baseClass = "inline-flex min-h-9 items-center justify-center rounded-control px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer";
const buttonClass = `${baseClass} border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50 outline-brand`;
const dangerClass = `${baseClass} border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 outline-red-600`;

const state = ref("loading");
const loadError = ref("");
const categories = ref([]);
const announcement = ref("");

// Top-level by name, each followed by its subcategories.
const ordered = computed(() => {
    const byName = (a, b) => a.name.localeCompare(b.name);
    const tops = categories.value.filter((category) => category.parentId === null).sort(byName);
    return tops.flatMap((top) => [top, ...categories.value.filter((category) => category.parentId === top.id).sort(byName)]);
});

const nameOf = (id) => categories.value.find((category) => category.id === id)?.name ?? "";

// "8 categories · 3 top-level · 2 inactive"
const summary = computed(() => {
    const all = categories.value;
    const tops = all.filter((category) => category.parentId === null).length;
    const inactive = all.filter((category) => !category.isActive).length;
    const parts = [`${all.length} ${all.length === 1 ? "category" : "categories"}`, `${tops} top-level`];
    if (inactive) parts.push(`${inactive} inactive`);
    return parts.join(" · ");
});

async function load() {
    state.value = "loading";

    try {
        categories.value = await adminCatalogService.listCategories();
        state.value = "ready";
    } catch (err) {
        const { status, message } = parseApiError(err);
        state.value = status === 403 ? "forbidden" : "error";
        loadError.value = message;
    }
}

load();

// Responses carry the saved category (with counts); swap it in.
function upsert(category) {
    const index = categories.value.findIndex((item) => item.id === category.id);
    if (index === -1) categories.value.push(category);
    else categories.value.splice(index, 1, category);
}

// ------------------------------------------------------------ unsaved changes

const dirtyForms = reactive(new Set());
const setDirty = (key, dirty) => (dirty ? dirtyForms.add(key) : dirtyForms.delete(key));
useUnsavedChanges(() => dirtyForms.size > 0);

// ------------------------------------------------------------ create

const creating = ref(false);
const createForm = ref(null);

async function openCreate() {
    creating.value = true;
    await nextTick();
    createForm.value?.focus();
}

async function closeCreate() {
    creating.value = false;
    setDirty("new", false);
    await nextTick();
    document.getElementById("new-category-button")?.focus();
}

// Saved parents' childCount comes from the server, so counts are re-read
// after the form has closed (focus is restored first, not after a request).
async function refreshCounts() {
    categories.value = await adminCatalogService.listCategories().catch(() => categories.value);
}

async function created(category) {
    upsert(category);
    announcement.value = `Category ${category.name} created.`;
    await closeCreate();
    if (category.parentId) refreshCounts();
}

// ------------------------------------------------------------ edit

const editingId = ref(null);
const editForm = ref(null);

async function openEdit(category) {
    if (editingId.value === category.id) return closeEdit();
    if (editingId.value && dirtyForms.has(editingId.value) && !window.confirm("Discard the changes to the open category?")) return;

    if (editingId.value) setDirty(editingId.value, false);
    editingId.value = category.id;
    statusFor.value = null;

    await nextTick();
    [].concat(editForm.value)[0]?.focus();
}

async function closeEdit() {
    const id = editingId.value;
    editingId.value = null;
    setDirty(id, false);

    await nextTick();
    document.getElementById(`category-${id}-edit`)?.focus();
}

async function updated(category) {
    upsert(category);
    announcement.value = `Category ${category.name} saved.`;
    await closeEdit();
    // Moving a subcategory changes two parents' childCount.
    refreshCounts();
}

// ------------------------------------------------------------ activate / deactivate

const statusSave = useAdminSave();
const statusFor = ref(null);

async function toggleActive(category) {
    if (category.isActive && !window.confirm(`Deactivate ${category.name}? It disappears from the store's category lists.`)) return;

    statusFor.value = category.id;
    const saved = await statusSave.run(
        () => adminCatalogService.updateCategory(category.id, { isActive: !category.isActive }),
        { successMessage: `${category.name} ${category.isActive ? "deactivated" : "activated"}.` },
    );

    if (saved) upsert(saved);
}
</script>
