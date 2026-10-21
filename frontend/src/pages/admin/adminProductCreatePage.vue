<template>
    <div class="mx-auto max-w-5xl">

        <RouterLink :to="{ name: 'admin-products' }"
            class="inline-flex items-center gap-1 rounded text-sm font-medium text-indigo-700 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600">
            <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
            Back to products
        </RouterLink>

        <h1 class="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">New product</h1>
        <p class="mt-1 text-sm text-slate-500">Fields marked <span aria-hidden="true">*</span><span class="sr-only">required</span> are required.</p>

        <form ref="formEl" novalidate class="mt-6 space-y-6" @submit.prevent="submit">

            <AdminFormStatus :alert="save.alert.value" />

            <section aria-labelledby="new-details-heading" class="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                <h2 id="new-details-heading" class="text-lg font-bold text-slate-900">Details</h2>
                <div v-if="categoriesError" class="mt-2 flex items-center gap-3 text-sm text-red-700">
                    Categories could not be loaded.
                    <button type="button" class="rounded font-semibold underline focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer"
                        @click="loadCategories">Try again</button>
                </div>
                <ProductDetailsFields class="mt-4" :form="form" :errors="save.errors" prefix="new-product"
                    :category-options="categoryOptions" :categories-error="categoriesError" show-active currency-editable />
            </section>

            <section aria-labelledby="new-variants-heading" class="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                <h2 id="new-variants-heading" class="text-lg font-bold text-slate-900">Variants</h2>
                <p class="mt-1 text-sm text-slate-500">At least one. Each size/color combination needs its own SKU.</p>

                <ol class="mt-4 space-y-4">
                    <li v-for="(variant, index) in variants" :key="variant.key"
                        class="rounded-lg border border-slate-200 p-3">
                        <div class="mb-2 flex items-center justify-between">
                            <h3 class="text-sm font-semibold text-slate-700">Variant {{ index + 1 }}</h3>
                            <button v-if="variants.length > 1" type="button"
                                class="rounded-md px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer"
                                @click="removeVariant(index)">
                                Remove<span class="sr-only"> variant {{ index + 1 }}</span>
                            </button>
                        </div>
                        <VariantFields :form="variant" :errors="save.errors" :prefix="`new-${variant.key}`" with-stock
                            :error-key="(name) => `variants[${index}].${name}`" :currency="form.currency"
                            :inherited-price="form.price" :inherited-original="form.originalPrice" />
                    </li>
                </ol>

                <button type="button" :disabled="variants.length >= LIMITS.variants"
                    class="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 cursor-pointer"
                    @click="addVariant">
                    <PlusIcon class="h-4 w-4" aria-hidden="true" />
                    Add variant
                </button>
            </section>

            <section aria-labelledby="new-images-heading" class="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                <h2 id="new-images-heading" class="text-lg font-bold text-slate-900">Images</h2>
                <p class="mt-1 text-sm text-slate-500">Full https:// image addresses; the first is the main image. Uploading files is not supported.</p>
                <GalleryEditor class="mt-4" :images="images" :errors="save.errors" prefix="new-image" />
            </section>

            <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <RouterLink :to="{ name: 'admin-products' }"
                    class="rounded-lg border border-slate-300 px-5 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
                    Cancel
                </RouterLink>
                <button type="submit" :disabled="save.saving.value"
                    class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 cursor-pointer">
                    {{ save.saving.value ? "Creating…" : "Create product" }}
                </button>
            </div>
        </form>
    </div>
</template>

<script setup>
import { nextTick, onMounted, reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { ChevronLeftIcon, PlusIcon } from "@heroicons/vue/20/solid";

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
