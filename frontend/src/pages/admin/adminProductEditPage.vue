<template>
    <div class="mx-auto max-w-5xl">

        <!-- Loading -->
        <template v-if="state === 'loading'">
            <AdminPageHeader title="Edit product" :back="BACK" />
            <AdminStatePanel kind="loading" class="mt-6" title="Loading product" />
        </template>

        <!-- Load failed: the panel's heading is the page's h1 -->
        <template v-else-if="state !== 'ready'">
            <AdminPageHeader :back="BACK" />
            <AdminStatePanel :kind="state === 'forbidden' ? 'forbidden' : 'error'" :heading-level="1" class="mt-4"
                :title="LOAD_STATES[state].title" :message="state === 'error' ? loadError : LOAD_STATES[state].text">
                <PrimaryButton v-if="state === 'error'" tag="button" variant="outline" @click="load">Try again</PrimaryButton>
                <PrimaryButton v-else :to="{ name: 'admin-products' }" variant="outline">Back to products</PrimaryButton>
            </AdminStatePanel>
        </template>

        <template v-else>
            <AdminPageHeader :title="product.name" :back="BACK">
                <template #meta>
                    <AdminBadge :tone="product.isActive ? 'success' : 'neutral'">{{ product.isActive ? "Active" : "Inactive" }}</AdminBadge>
                    <span class="font-mono text-xs text-slate-500">#{{ product.id }}</span>
                    <span aria-hidden="true" class="text-slate-300">·</span>
                    <span>In {{ product.orderItemCount }} order {{ product.orderItemCount === 1 ? "line" : "lines" }}</span>
                </template>
                <template #actions>
                    <PrimaryButton v-if="product.isActive" :to="{ name: 'product-details', params: { id: product.id } }"
                        variant="outline" size="sm">
                        <ArrowTopRightOnSquareIcon class="-ml-1 h-4 w-4" aria-hidden="true" />
                        View in store
                    </PrimaryButton>
                    <PrimaryButton tag="button" size="sm" :variant="product.isActive ? 'danger-outline' : 'primary'"
                        :disabled="statusSave.saving.value" @click="toggleProductActive">
                        {{ statusSave.saving.value ? "Saving…" : product.isActive ? "Deactivate product" : "Activate product" }}
                    </PrimaryButton>
                </template>
            </AdminPageHeader>

            <AdminFormStatus class="mt-4" :alert="statusSave.alert.value" :success="statusSave.success.value || createdMessage" />

            <!-- Details -->
            <form ref="detailsEl" novalidate aria-labelledby="details-heading" :class="[CARD, 'mt-6']" @submit.prevent="saveDetails">
                <AdminSectionHeading heading-id="details-heading" title="Details"
                    text="Name, category and pricing. The currency is fixed once a product exists." />
                <AdminFormStatus class="mt-4" :alert="detailsSave.alert.value" :success="detailsSave.success.value" />
                <ProductDetailsFields class="mt-5" :form="details" :errors="detailsSave.errors" prefix="edit-product"
                    :category-options="categoryOptions" :categories-error="categoriesError" slug-required
                    :current-category-id="String(product.category.id)" />
                <div :class="FOOTER">
                    <p v-if="detailsDirty" class="mr-auto text-sm font-medium text-amber-800">Unsaved changes</p>
                    <PrimaryButton tag="button" variant="outline" :disabled="!detailsDirty || detailsSave.saving.value"
                        @click="resetDetails">
                        Undo changes
                    </PrimaryButton>
                    <PrimaryButton tag="button" type="submit" :loading="detailsSave.saving.value">
                        {{ detailsSave.saving.value ? "Saving…" : "Save details" }}
                    </PrimaryButton>
                </div>
            </form>

            <!-- Variants -->
            <section aria-labelledby="variants-heading" :class="[CARD, 'mt-6']">
                <AdminSectionHeading heading-id="variants-heading" title="Variants"
                    text="Each change saves on its own. Deactivated variants stay in order history and can be activated again." />
                <VariantManager class="mt-5" :product="product" @updated="replaceProduct" @dirty="variantsDirty = $event" />
            </section>

            <!-- Gallery -->
            <form ref="galleryEl" novalidate aria-labelledby="gallery-heading" :class="[CARD, 'mt-6']" @submit.prevent="saveGallery">
                <AdminSectionHeading heading-id="gallery-heading" title="Images"
                    text="Reorder, replace or remove image addresses, then save. Saving replaces the whole gallery; the first image is the main one." />
                <AdminFormStatus class="mt-4" :alert="gallerySave.alert.value" :success="gallerySave.success.value" />
                <GalleryEditor class="mt-5" :images="gallery" :errors="gallerySave.errors" prefix="edit-image"
                    :disabled="gallerySave.saving.value" />
                <div :class="FOOTER">
                    <p v-if="galleryDirty" class="mr-auto text-sm font-medium text-amber-800">Unsaved changes</p>
                    <PrimaryButton tag="button" variant="outline" :disabled="!galleryDirty || gallerySave.saving.value"
                        @click="resetGallery">
                        Undo changes
                    </PrimaryButton>
                    <PrimaryButton tag="button" type="submit" :loading="gallerySave.saving.value">
                        {{ gallerySave.saving.value ? "Saving…" : "Save images" }}
                    </PrimaryButton>
                </div>
            </form>
        </template>
    </div>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowTopRightOnSquareIcon } from "@heroicons/vue/20/solid";

import AdminBadge from "@/components/admin/ui/adminBadge.vue";
import AdminPageHeader from "@/components/admin/ui/adminPageHeader.vue";
import AdminSectionHeading from "@/components/admin/ui/adminSectionHeading.vue";
import AdminStatePanel from "@/components/admin/ui/adminStatePanel.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import GalleryEditor from "@/components/admin/products/galleryEditor.vue";
import ProductDetailsFields from "@/components/admin/products/productDetailsFields.vue";
import VariantManager from "@/components/admin/products/variantManager.vue";
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

const BACK = { label: "Back to products", to: { name: "admin-products" } };
const CARD = "rounded-card border border-slate-200 bg-white p-4 shadow-card sm:p-6";
const FOOTER = "mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4";

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
