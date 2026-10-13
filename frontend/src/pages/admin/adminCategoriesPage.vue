<template>
    <div class="mx-auto max-w-5xl">

        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 class="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Categories</h1>
                <p class="mt-1 text-sm text-slate-500">
                    Two levels: top-level categories and their subcategories. Categories are deactivated, never deleted.
                </p>
            </div>
            <button v-if="state === 'ready' && !creating" id="new-category-button" type="button"
                class="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer"
                @click="openCreate">
                <PlusIcon class="h-5 w-5" aria-hidden="true" />
                New category
            </button>
        </div>

        <p class="sr-only" aria-live="polite">{{ announcement }}</p>

        <section v-if="state === 'loading'"
            class="mt-6 flex min-h-60 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
            <LoadingSpinner class="text-slate-400" label="Loading categories" />
        </section>

        <section v-else-if="state === 'forbidden'"
            class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-amber-300 bg-white px-4 text-center">
            <h2 class="text-xl font-bold text-slate-900">Admin access required</h2>
            <p class="mt-2 max-w-md text-slate-500">
                The server did not accept your account as an administrator. Sign out and sign in again if your access changed.
            </p>
        </section>

        <section v-else-if="state === 'error'"
            class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center">
            <h2 class="text-xl font-bold text-slate-900">Categories unavailable</h2>
            <p class="mt-2 text-slate-500">{{ loadError }}</p>
            <button type="button"
                class="mt-6 rounded-lg border border-slate-200 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer"
                @click="load">
                Try again
            </button>
        </section>

        <template v-else>
            <section v-if="creating" aria-labelledby="new-category-heading"
                class="mt-6 rounded-xl border border-indigo-200 bg-white p-4 sm:p-6">
                <h2 id="new-category-heading" class="mb-4 text-lg font-bold text-slate-900">New category</h2>
                <CategoryForm ref="createForm" :categories="categories" @saved="created" @cancel="closeCreate"
                    @dirty="setDirty('new', $event)" />
            </section>

            <p v-if="!categories.length" class="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-slate-500">
                No categories yet.
            </p>

            <ul v-else class="mt-6 space-y-2" aria-label="Categories">
                <li v-for="category in ordered" :key="category.id"
                    class="rounded-lg border bg-white" :class="[category.parentId ? 'sm:ml-8' : '', category.isActive ? 'border-slate-200' : 'border-dashed border-slate-300 bg-slate-50']">
                    <div class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                        <div class="min-w-0 flex-1">
                            <p class="wrap-anywhere font-semibold text-slate-900">
                                <span v-if="category.parentId" class="sr-only">Subcategory of {{ nameOf(category.parentId) }}: </span>
                                {{ category.name }}
                            </p>
                            <p class="wrap-anywhere text-sm text-slate-500">
                                <span class="font-mono text-xs">{{ category.slug }}</span>
                                · {{ category.productCount }} {{ category.productCount === 1 ? "product" : "products" }}
                                <template v-if="!category.parentId">· {{ category.childCount }} {{ category.childCount === 1 ? "subcategory" : "subcategories" }}</template>
                            </p>
                        </div>
                        <span class="self-start rounded-full px-2.5 py-0.5 text-xs font-semibold sm:self-center"
                            :class="category.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'">
                            {{ category.isActive ? "Active" : "Inactive" }}
                        </span>
                        <div class="flex gap-2">
                            <button :id="`category-${category.id}-edit`" type="button" :aria-expanded="editingId === category.id"
                                :aria-controls="`category-${category.id}-panel`" :class="buttonClass" @click="openEdit(category)">
                                Edit<span class="sr-only"> {{ category.name }}</span>
                            </button>
                            <button type="button" :disabled="statusSave.saving.value" :class="buttonClass" @click="toggleActive(category)">
                                {{ category.isActive ? "Deactivate" : "Activate" }}<span class="sr-only"> {{ category.name }}</span>
                            </button>
                        </div>
                    </div>

                    <div v-if="statusFor === category.id && (statusSave.alert.value || statusSave.success.value)" class="px-3 pb-3">
                        <AdminFormStatus :alert="statusSave.alert.value" :success="statusSave.success.value" />
                    </div>

                    <div v-if="editingId === category.id" :id="`category-${category.id}-panel`" class="border-t border-slate-200 p-3 sm:p-4">
                        <CategoryForm ref="editForm" :category="category" :categories="categories"
                            @saved="updated" @cancel="closeEdit" @dirty="setDirty(category.id, $event)" />
                    </div>
                </li>
            </ul>
        </template>
    </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from "vue";
import { PlusIcon } from "@heroicons/vue/20/solid";

import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import CategoryForm from "@/components/admin/categories/categoryForm.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import { adminCatalogService } from "@/services/adminCatalogService";
import { parseApiError } from "@/services/apiClient";
import { useAdminSave } from "@/composables/useAdminSave";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";

const buttonClass = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 cursor-pointer";

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
