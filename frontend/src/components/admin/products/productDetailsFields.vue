<template>
    <!-- Edits `form` in place (a reactive object owned by the page). -->
    <div class="grid gap-4 sm:grid-cols-2">

        <AdminField :id="`${prefix}-name`" label="Name" required :error="errors.name" class="sm:col-span-2" v-slot="f">
            <input :id="f.id" v-bind="f.attrs" v-model="form.name" type="text" :maxlength="LIMITS.productName"
                autocomplete="off" :class="f.controlClass" />
        </AdminField>

        <AdminField :id="`${prefix}-slug`" label="Slug" :required="slugRequired" :optional="!slugRequired"
            :error="errors.slug" :hint="slugHint" v-slot="f">
            <input :id="f.id" v-bind="f.attrs" v-model="form.slug" type="text" :maxlength="LIMITS.productSlug"
                autocomplete="off" spellcheck="false" :placeholder="slugPlaceholder" :class="[f.controlClass, 'font-mono']" />
        </AdminField>

        <AdminField :id="`${prefix}-brand`" label="Brand" optional :error="errors.brand" v-slot="f">
            <input :id="f.id" v-bind="f.attrs" v-model="form.brand" type="text" :maxlength="LIMITS.brand"
                autocomplete="off" :class="f.controlClass" />
        </AdminField>

        <AdminField :id="`${prefix}-category`" label="Category" required :error="errors.categoryId"
            :hint="categoriesError ? '' : 'Inactive categories cannot take products.'" class="sm:col-span-2" v-slot="f">
            <select :id="f.id" v-bind="f.attrs" v-model="form.categoryId" :disabled="categoriesError" :class="f.controlClass">
                <option value="" disabled>{{ categoriesError ? "Categories could not be loaded" : "Choose a category" }}</option>
                <option v-for="option in categoryOptions" :key="option.value" :value="option.value"
                    :disabled="!option.isActive && option.value !== currentCategoryId">
                    {{ option.isChild ? "  — " : "" }}{{ option.label }}{{ option.isActive ? "" : " (inactive)" }}
                </option>
            </select>
        </AdminField>

        <AdminField v-if="currencyEditable" :id="`${prefix}-currency`" label="Currency" required :error="errors.currency"
            hint="Every price of this product and its variants is in this currency. It cannot be changed later."
            class="sm:col-span-2" v-slot="f">
            <select :id="f.id" v-bind="f.attrs" v-model="form.currency" :class="f.controlClass">
                <option v-for="code in CURRENCIES" :key="code" :value="code">{{ code }}</option>
            </select>
        </AdminField>

        <AdminField :id="`${prefix}-price`" :label="`Price (${form.currency})`" required :error="errors.price" v-slot="f">
            <input :id="f.id" v-bind="f.attrs" v-model="form.price" type="text" inputmode="decimal"
                autocomplete="off" placeholder="0.00" :class="f.controlClass" />
        </AdminField>

        <AdminField :id="`${prefix}-original-price`" :label="`Compare-at price (${form.currency})`" optional
            :error="errors.originalPrice" hint="The crossed-out &quot;was&quot; price. Must be higher than the price." v-slot="f">
            <input :id="f.id" v-bind="f.attrs" v-model="form.originalPrice" type="text" inputmode="decimal"
                autocomplete="off" placeholder="0.00" :class="f.controlClass" />
        </AdminField>

        <AdminField :id="`${prefix}-description`" label="Description" optional :error="errors.description"
            class="sm:col-span-2" v-slot="f">
            <textarea :id="f.id" v-bind="f.attrs" v-model="form.description" rows="4" :maxlength="LIMITS.text"
                :class="f.controlClass"></textarea>
        </AdminField>

        <fieldset class="sm:col-span-2">
            <legend class="text-sm font-medium text-slate-900">Options</legend>
            <div class="mt-1 flex flex-wrap gap-x-6">
                <label class="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-slate-900">
                    <input v-model="form.isNew" type="checkbox"
                        class="h-5 w-5 cursor-pointer rounded accent-brand outline-brand focus-visible:outline-2 focus-visible:outline-offset-2" />
                    Mark as new arrival
                </label>
                <label v-if="showActive" class="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-slate-900">
                    <input v-model="form.isActive" type="checkbox"
                        class="h-5 w-5 cursor-pointer rounded accent-brand outline-brand focus-visible:outline-2 focus-visible:outline-offset-2" />
                    Visible in the store (active)
                </label>
            </div>
        </fieldset>

    </div>
</template>

<script setup>
import { computed } from "vue";

import AdminField from "@/components/admin/form/adminField.vue";
import { CURRENCIES, LIMITS, slugify } from "@/utils/adminCatalogRules";

const props = defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, required: true },
    categoryOptions: { type: Array, default: () => [] },
    categoriesError: { type: Boolean, default: false },
    prefix: { type: String, default: "product" },
    // Edit: the slug must stay set. Create: blank means "generate".
    slugRequired: { type: Boolean, default: false },
    showActive: { type: Boolean, default: false },
    // Create only: an existing product's currency is fixed.
    currencyEditable: { type: Boolean, default: false },
    // An existing product's current (possibly inactive) category stays selectable.
    currentCategoryId: { type: String, default: "" },
});

const generated = computed(() => slugify([props.form.brand, props.form.name].filter((part) => part.trim()).join(" ")));

const slugPlaceholder = computed(() => (props.slugRequired ? "" : generated.value || "generated-from-brand-and-name"));

const slugHint = computed(() => (props.slugRequired
    ? "Used in links. Changing it changes the product's URL slug."
    : "Leave blank to generate it from the brand and name."));
</script>
