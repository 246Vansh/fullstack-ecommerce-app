<template>
    <div class="mx-auto max-w-5xl">

        <AdminPageHeader title="New product" :back="{ label: 'Back to products', to: { name: 'admin-products' } }">
            <template #meta>
                <p>Fields marked <span class="text-red-700" aria-hidden="true">*</span><span class="sr-only">required</span> are required.</p>
            </template>
        </AdminPageHeader>

        <form ref="formEl" novalidate class="mt-6 space-y-6" @submit.prevent="submit">

            <AdminFormStatus :alert="save.alert.value" />

            <section aria-labelledby="new-details-heading" :class="CARD">
                <AdminSectionHeading heading-id="new-details-heading" step="1" title="Details"
                    text="Name, category and pricing as shoppers will see them." />
                <div v-if="categoriesError" role="alert"
                    class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    Categories could not be loaded.
                    <button type="button"
                        class="rounded font-semibold underline underline-offset-2 outline-red-600 focus-visible:outline-2 cursor-pointer"
                        @click="loadCategories">Try again</button>
                </div>
                <ProductDetailsFields class="mt-5" :form="form" :errors="save.errors" prefix="new-product"
                    :category-options="categoryOptions" :categories-error="categoriesError" show-active currency-editable />
            </section>

            <section aria-labelledby="new-variants-heading" :class="CARD">
                <AdminSectionHeading heading-id="new-variants-heading" step="2" title="Variants"
                    text="At least one. Each size/color combination needs its own SKU." />

                <ol class="mt-5 space-y-4">
                    <li v-for="(variant, index) in variants" :key="variant.key"
                        class="rounded-control border border-slate-200 bg-slate-50/60 p-4">
                        <div class="mb-3 flex min-h-9 items-center justify-between gap-3">
                            <h3 class="text-sm font-semibold text-slate-900">Variant {{ index + 1 }}</h3>
                            <PrimaryButton v-if="variants.length > 1" tag="button" variant="danger-outline" size="sm"
                                @click="removeVariant(index)">
                                <TrashIcon class="-ml-1 h-4 w-4" aria-hidden="true" />
                                Remove<span class="sr-only"> variant {{ index + 1 }}</span>
                            </PrimaryButton>
                        </div>
                        <VariantFields :form="variant" :errors="save.errors" :prefix="`new-${variant.key}`" with-stock
                            :error-key="(name) => `variants[${index}].${name}`" :currency="form.currency"
                            :inherited-price="form.price" :inherited-original="form.originalPrice" />
                    </li>
                </ol>

                <div class="mt-4 flex flex-wrap items-center gap-3">
                    <PrimaryButton tag="button" variant="outline" size="sm" :disabled="variants.length >= LIMITS.variants"
                        @click="addVariant">
                        <PlusIcon class="-ml-1 h-4 w-4" aria-hidden="true" />
                        Add variant
                    </PrimaryButton>
                    <span v-if="variants.length >= LIMITS.variants" class="text-xs text-slate-600">Up to {{ LIMITS.variants }} variants.</span>
                </div>
            </section>

            <section aria-labelledby="new-images-heading" :class="CARD">
                <AdminSectionHeading heading-id="new-images-heading" step="3" title="Images"
                    text="Full https:// image addresses; the first is the main image. Uploading files is not supported." />
                <GalleryEditor class="mt-5" :images="images" :errors="save.errors" prefix="new-image" />
            </section>

            <div class="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-end">
                <PrimaryButton :to="{ name: 'admin-products' }" variant="outline">Cancel</PrimaryButton>
                <PrimaryButton tag="button" type="submit" :loading="save.saving.value">
                    {{ save.saving.value ? "Creating…" : "Create product" }}
                </PrimaryButton>
            </div>
        </form>
    </div>
</template>

<script setup>
import { nextTick, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { PlusIcon, TrashIcon } from "@heroicons/vue/20/solid";

import AdminPageHeader from "@/components/admin/ui/adminPageHeader.vue";
import AdminSectionHeading from "@/components/admin/ui/adminSectionHeading.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import ProductDetailsFields from "@/components/admin/products/productDetailsFields.vue";
import VariantFields from "@/components/admin/products/variantFields.vue";
import GalleryEditor from "@/components/admin/products/galleryEditor.vue";
import { adminCatalogService } from "@/services/adminCatalogService";
import { toCategoryOptions } from "@/composables/useAdminProducts";
import { useAdminSave } from "@/composables/useAdminSave";
import { useFocusFirstError } from "@/composables/useFocusFirstError";
import { useUnsavedChanges } from "@/composables/useUnsavedChanges";
import {
    LIMITS, emptyProductForm, emptyVariantForm, hasErrors, imageErrors, imagesPayload,
    productErrors, productPayload, variantErrors, variantPayload,
} from "@/utils/adminCatalogRules";

const CARD = "rounded-card border border-slate-200 bg-white p-4 shadow-card sm:p-6";

const router = useRouter();
const save = useAdminSave();
const formEl = ref(null);

let variantKey = 0;
const newVariantRow = () => ({ key: `variant-${++variantKey}`, ...emptyVariantForm() });

const form = reactive(emptyProductForm());
const variants = reactive([newVariantRow()]);
const images = reactive([]);

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

onMounted(loadCategories);

// ------------------------------------------------------------ unsaved changes

const snapshot = () => JSON.stringify([form, variants.map(({ key, ...v }) => v), images.map(({ key, ...i }) => i)]);
let pristine = snapshot();
let submitted = false;

useUnsavedChanges(() => !submitted && snapshot() !== pristine);

// ------------------------------------------------------------ variants

async function addVariant() {
    const row = newVariantRow();
    variants.push(row);

    await nextTick();
    document.getElementById(`new-${row.key}-sku`)?.focus();
}

async function removeVariant(index) {
    variants.splice(index, 1);

    await nextTick();
    document.getElementById(`new-${variants[Math.min(index, variants.length - 1)].key}-sku`)?.focus();
}

// ------------------------------------------------------------ submit

useFocusFirstError(formEl, () => save.errors);

// Server error keys this form can show next to a field.
const isField = (key) => key in form || /^variants\[\d+\]\.\w+$/.test(key) || /^images\[\d+\]\.\w+$/.test(key);

function validate() {
    const errors = { ...productErrors(form), ...imageErrors(images) };
    const seen = new Map();

    variants.forEach((variant, index) => {
        for (const [field, message] of Object.entries(variantErrors(variant, form, { withStock: true }))) {
            errors[`variants[${index}].${field}`] = message;
        }

        const sku = variant.sku.trim().toUpperCase();
        if (sku && seen.has(sku) && !errors[`variants[${index}].sku`]) {
            errors[`variants[${index}].sku`] = `Same SKU as variant ${seen.get(sku) + 1}`;
        }
        if (sku && !seen.has(sku)) seen.set(sku, index);
    });

    return errors;
}

async function submit() {
    const errors = validate();
    if (hasErrors(errors)) return save.rejectLocally(errors);

    const payload = {
        ...productPayload(form, { create: true }),
        variants: variants.map((variant) => variantPayload(variant, { withStock: true })),
        images: imagesPayload(images),
    };

    const product = await save.run(() => adminCatalogService.createProduct(payload), { isField });

    if (product) {
        submitted = true;
        router.push({ name: "admin-product-edit", params: { id: product.id }, query: { created: "1" } });
    }
}
</script>
