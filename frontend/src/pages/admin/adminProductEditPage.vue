<template>
    <div class="mx-auto max-w-5xl">

        <RouterLink :to="{ name: 'admin-products' }"
            class="inline-flex items-center gap-1 rounded text-sm font-medium text-indigo-700 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600">
            <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
            Back to products
        </RouterLink>

        <!-- Loading -->
        <template v-if="state === 'loading'">
            <h1 class="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Edit product</h1>
            <section class="mt-6 flex min-h-60 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
                <LoadingSpinner class="text-slate-400" label="Loading product" />
            </section>
        </template>

        <!-- Load failed -->
        <template v-else-if="state !== 'ready'">
            <h1 class="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{{ LOAD_STATES[state].title }}</h1>
            <section class="mt-6 flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center">
                <p class="max-w-md text-slate-500">{{ state === "error" ? loadError : LOAD_STATES[state].text }}</p>
                <button v-if="state === 'error'" type="button"
                    class="mt-6 rounded-lg border border-slate-200 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer"
                    @click="load">
                    Try again
                </button>
            </section>
        </template>

        <template v-else>
            <!-- Header -->
            <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                    <h1 class="wrap-anywhere text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{{ product.name }}</h1>
                    <p class="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                            :class="product.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'">
                            {{ product.isActive ? "Active" : "Inactive" }}
                        </span>
                        <span>#{{ product.id }}</span>
                        <span>· In {{ product.orderItemCount }} order {{ product.orderItemCount === 1 ? "line" : "lines" }}</span>
                    </p>
                </div>
                <div class="flex shrink-0 flex-wrap gap-2">
                    <RouterLink v-if="product.isActive" :to="{ name: 'product-details', params: { id: product.id } }"
                        class="rounded-lg px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
                        View in store
                    </RouterLink>
                    <button type="button" :disabled="statusSave.saving.value"
                        class="rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-60 cursor-pointer"
                        :class="product.isActive ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-green-300 text-green-800 hover:bg-green-50'"
                        @click="toggleProductActive">
                        {{ statusSave.saving.value ? "Saving…" : product.isActive ? "Deactivate product" : "Activate product" }}
                    </button>
                </div>
            </div>

            <AdminFormStatus class="mt-4" :alert="statusSave.alert.value" :success="statusSave.success.value || createdMessage" />

            <!-- Details -->
            <form ref="detailsEl" novalidate aria-labelledby="details-heading"
                class="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-6" @submit.prevent="saveDetails">
                <h2 id="details-heading" class="text-lg font-bold text-slate-900">Details</h2>
                <AdminFormStatus class="mt-3" :alert="detailsSave.alert.value" :success="detailsSave.success.value" />
                <ProductDetailsFields class="mt-4" :form="details" :errors="detailsSave.errors" prefix="edit-product"
                    :category-options="categoryOptions" :categories-error="categoriesError" slug-required
                    :current-category-id="String(product.category.id)" />
                <div class="mt-4 flex justify-end gap-2">
                    <button type="button" :disabled="!detailsDirty || detailsSave.saving.value"
                        class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 cursor-pointer"
                        @click="resetDetails">
                        Undo changes
                    </button>
                    <button type="submit" :disabled="detailsSave.saving.value"
                        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 cursor-pointer">
                        {{ detailsSave.saving.value ? "Saving…" : "Save details" }}
                    </button>
                </div>
            </form>

            <!-- Variants -->
            <section aria-labelledby="variants-heading" class="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                <h2 id="variants-heading" class="text-lg font-bold text-slate-900">Variants</h2>
                <p class="mt-1 text-sm text-slate-500">
                    Each change saves on its own. Deactivated variants stay in order history and can be activated again.
                </p>
                <VariantManager class="mt-4" :product="product" @updated="replaceProduct" @dirty="variantsDirty = $event" />
            </section>

            <!-- Gallery -->
            <form ref="galleryEl" novalidate aria-labelledby="gallery-heading"
                class="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-6" @submit.prevent="saveGallery">
                <h2 id="gallery-heading" class="text-lg font-bold text-slate-900">Images</h2>
                <p class="mt-1 text-sm text-slate-500">
                    Reorder, replace or remove image addresses, then save. Saving replaces the whole gallery; the first image is the main one.
                </p>
                <AdminFormStatus class="mt-3" :alert="gallerySave.alert.value" :success="gallerySave.success.value" />
                <GalleryEditor class="mt-4" :images="gallery" :errors="gallerySave.errors" prefix="edit-image"
                    :disabled="gallerySave.saving.value" />
                <div class="mt-4 flex justify-end gap-2">
                    <button type="button" :disabled="!galleryDirty || gallerySave.saving.value"
                        class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 cursor-pointer"
                        @click="resetGallery">
                        Undo changes
                    </button>
                    <button type="submit" :disabled="gallerySave.saving.value"
                        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 cursor-pointer">
                        {{ gallerySave.saving.value ? "Saving…" : "Save images" }}
                    </button>
                </div>
            </form>
        </template>
    </div>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ChevronLeftIcon } from "@heroicons/vue/20/solid";

import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import GalleryEditor from "@/components/admin/products/galleryEditor.vue";
import ProductDetailsFields from "@/components/admin/products/productDetailsFields.vue";
import VariantManager from "@/components/admin/products/variantManager.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import { adminCatalogService } from "@/services/adminCatalogService";
import { parseApiError } from "@/services/apiClient";
import { toCategoryOptions } from "@/composables/useAdminProducts";
import { useAdminSave } from "@/composables/useAdminSave";
import { useFocusFirstError } from "@/composables/useFocusFirstError";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import { setPageTitle, focusHeadingAfterLoad } from "@/router/pageFocus";
import {
    changedFields, hasErrors, imageErrors, imageFormsFrom, imagesPayload,
    productErrors, productFormFrom, productPayload,
} from "@/utils/adminCatalogRules";

const LOAD_STATES = {
    notFound: { title: "Product not found", text: "This product does not exist. It may have been removed from the database." },
    forbidden: { title: "Admin access required", text: "The server did not accept your account as an administrator. Sign out and sign in again if your access changed." },
    error: { title: "Product unavailable", text: "" },
};

const route = useRoute();
const router = useRouter();
const productId = Number(route.params.id);

const state = ref("loading");
const loadError = ref("");
const product = ref(null);

// "Product created." after arriving from the create page.
const createdMessage = ref(route.query.created ? "Product created. You can keep editing it here." : "");

// ------------------------------------------------------------ categories

const categoryOptions = ref([]);
const categoriesError = ref(false);

async function loadCategories() {
    categoriesError.value = false;
    try {
        categoryOptions.value = toCategoryOptions(await adminCatalogService.listCategories());
    } catch {
        categoriesError.value = true;
    }
}

// ------------------------------------------------------------ section drafts

// Each section keeps its own draft and baseline, so saving one section (which
// returns the whole product) never discards unsaved edits in another.
const details = reactive({});
const detailsBaseline = ref({});
const gallery = reactive([]);
const galleryBaseline = ref([]);
const variantsDirty = ref(false);

function resetDetails() {
    Object.assign(details, productFormFrom(product.value));
    detailsBaseline.value = productPayload(details);
    detailsSave.clear();
}

function resetGallery() {
    gallery.splice(0, gallery.length, ...imageFormsFrom(product.value.images));
    galleryBaseline.value = imagesPayload(gallery);
    gallerySave.clear();
}

const detailsDirty = computed(() => state.value === "ready"
    && Object.keys(changedFields(productPayload(details), detailsBaseline.value)).length > 0);
const galleryDirty = computed(() => state.value === "ready"
    && JSON.stringify(imagesPayload(gallery)) !== JSON.stringify(galleryBaseline.value));

useUnsavedChanges(() => detailsDirty.value || galleryDirty.value || variantsDirty.value);

const replaceProduct = (next) => {
    product.value = next;
    setPageTitle(`${next.name} · Admin`);
};

// ------------------------------------------------------------ load

async function load() {
    state.value = "loading";

    const [result] = await Promise.allSettled([adminCatalogService.getProduct(productId), loadCategories()]);

    if (result.status === "rejected") {
        const { status, message } = parseApiError(result.reason);
        state.value = status === 404 ? "notFound" : status === 403 ? "forbidden" : "error";
        loadError.value = message;
        return;
    }

    replaceProduct(result.value);
    resetDetails();
    resetGallery();
    state.value = "ready";
    focusHeadingAfterLoad();

    // The "created" flag is one-time; drop it so a reload does not repeat the message.
    if (route.query.created) router.replace({ query: {} });
}

// ------------------------------------------------------------ status

const statusSave = useAdminSave();

async function toggleProductActive() {
    const active = product.value.isActive;

    if (active && !window.confirm("Deactivate this product? It leaves the store; order history and carts keep their records, and you can activate it again.")) {
        return;
    }

    createdMessage.value = "";
    const next = await statusSave.run(
        () => (active ? adminCatalogService.deactivateProduct(productId) : adminCatalogService.updateProduct(productId, { isActive: true })),
        { successMessage: active ? "Product deactivated. It is hidden from the store." : "Product activated. It is visible in the store." },
    );

    if (next) replaceProduct(next);
}

// ------------------------------------------------------------ details

const detailsSave = useAdminSave();
const detailsEl = ref(null);
useFocusFirstError(detailsEl, () => detailsSave.errors);

async function saveDetails() {
    const errors = productErrors(details, { slugRequired: true });
    if (hasErrors(errors)) return detailsSave.rejectLocally(errors);

    const changes = changedFields(productPayload(details), detailsBaseline.value);
    if (!Object.keys(changes).length) {
        detailsSave.clear();
        detailsSave.success.value = "No changes to save.";
        return;
    }

    createdMessage.value = "";
    const next = await detailsSave.run(() => adminCatalogService.updateProduct(productId, changes), {
        successMessage: "Details saved.",
        // Variant conflicts (variants[<id>].originalPrice) are listed in the alert.
        isField: (key) => key in details,
    });

    if (next) {
        replaceProduct(next);
        Object.assign(details, productFormFrom(next));
        detailsBaseline.value = productPayload(details);
    }
}

// ------------------------------------------------------------ gallery

const gallerySave = useAdminSave();
const galleryEl = ref(null);
useFocusFirstError(galleryEl, () => gallerySave.errors);

async function saveGallery() {
    const errors = imageErrors(gallery);
    if (hasErrors(errors)) return gallerySave.rejectLocally(errors);

    if (!galleryDirty.value) {
        gallerySave.clear();
        gallerySave.success.value = "No changes to save.";
        return;
    }

    createdMessage.value = "";
    const next = await gallerySave.run(() => adminCatalogService.replaceImages(productId, imagesPayload(gallery)), {
        successMessage: "Images saved.",
        isField: (key) => /^images\[\d+\]\.\w+$/.test(key),
    });

    if (next) {
        replaceProduct(next);
        gallery.splice(0, gallery.length, ...imageFormsFrom(next.images));
        galleryBaseline.value = imagesPayload(gallery);
    }
}

load();
</script>
