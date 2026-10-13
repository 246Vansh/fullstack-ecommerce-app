<template>
    <li class="rounded-lg border bg-white" :class="variant.isActive ? 'border-slate-200' : 'border-dashed border-slate-300 bg-slate-50'">

        <!-- Summary -->
        <div class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            <div class="flex min-w-0 flex-1 items-center gap-3">
                <span class="h-8 w-8 shrink-0 rounded-md border border-slate-300"
                    :style="variant.colorHex ? { backgroundColor: variant.colorHex } : {}" aria-hidden="true"></span>
                <div class="min-w-0">
                    <p class="wrap-anywhere font-mono text-sm font-semibold text-slate-900">{{ variant.sku }}</p>
                    <p class="text-sm text-slate-500">{{ optionLabel }}</p>
                </div>
            </div>

            <dl class="grid grid-cols-3 gap-3 text-sm sm:flex sm:items-center sm:gap-6">
                <div>
                    <dt class="text-xs text-slate-500">Price</dt>
                    <dd class="font-semibold text-slate-900">
                        {{ formatPrice(variant.effectivePrice) }}
                        <span v-if="variant.price == null" class="block text-xs font-normal text-slate-500">product price</span>
                    </dd>
                </div>
                <div>
                    <dt class="text-xs text-slate-500">Stock</dt>
                    <dd class="font-semibold" :class="variant.stock === 0 ? 'text-red-700' : 'text-slate-900'">{{ variant.stock }}</dd>
                </div>
                <div>
                    <dt class="text-xs text-slate-500">Status</dt>
                    <dd>
                        <span class="rounded-full px-2 py-0.5 text-xs font-semibold"
                            :class="variant.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'">
                            {{ variant.isActive ? "Active" : "Inactive" }}
                        </span>
                    </dd>
                </div>
            </dl>

            <div class="flex flex-wrap gap-2 sm:justify-end">
                <button type="button" :id="`${prefix}-edit-toggle`" :aria-expanded="panel === 'edit'"
                    :aria-controls="`${prefix}-panel`" :class="buttonClass" :disabled="save.saving.value" @click="toggle('edit')">
                    Edit<span class="sr-only"> {{ variant.sku }}</span>
                </button>
                <button type="button" :id="`${prefix}-stock-toggle`" :aria-expanded="panel === 'stock'"
                    :aria-controls="`${prefix}-panel`" :class="buttonClass" :disabled="save.saving.value" @click="toggle('stock')">
                    Stock<span class="sr-only"> for {{ variant.sku }}</span>
                </button>
                <button type="button" :class="buttonClass" :disabled="save.saving.value" @click="toggleActive">
                    {{ variant.isActive ? "Deactivate" : "Activate" }}<span class="sr-only"> {{ variant.sku }}</span>
                </button>
            </div>
        </div>

        <div v-if="!panel && (save.alert.value || save.success.value)" class="px-3 pb-3">
            <AdminFormStatus :alert="save.alert.value" :success="save.success.value" />
        </div>

        <!-- Edit panel -->
        <form v-if="panel === 'edit'" :id="`${prefix}-panel`" ref="panelEl" novalidate
            class="space-y-3 border-t border-slate-200 p-3" :aria-label="`Edit variant ${variant.sku}`" @submit.prevent="saveEdit">
            <AdminFormStatus :alert="save.alert.value" :success="save.success.value" />
            <VariantFields :form="editForm" :errors="save.errors" :prefix="`${prefix}-edit`"
                :inherited-price="productPrices.price" :inherited-original="productPrices.originalPrice" />
            <div class="flex gap-2">
                <button type="submit" :disabled="save.saving.value" :class="primaryClass">
                    {{ save.saving.value ? "Saving…" : "Save variant" }}
                </button>
                <button type="button" :disabled="save.saving.value" :class="buttonClass" @click="close()">Cancel</button>
            </div>
        </form>

        <!-- Stock panel -->
        <form v-else-if="panel === 'stock'" :id="`${prefix}-panel`" ref="panelEl" novalidate
            class="space-y-3 border-t border-slate-200 p-3" :aria-label="`Stock for ${variant.sku}`" @submit.prevent="saveStock">
            <AdminFormStatus :alert="save.alert.value" :success="save.success.value" />
            <fieldset>
                <legend class="text-sm font-medium text-slate-700">Change stock (currently {{ variant.stock }})</legend>
                <div class="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                    <label class="inline-flex items-center gap-2">
                        <input v-model="stockMode" type="radio" value="adjust" :name="`${prefix}-stock-mode`"
                            class="h-4 w-4 border-slate-300 text-indigo-600" />
                        Add or remove units
                    </label>
                    <label class="inline-flex items-center gap-2">
                        <input v-model="stockMode" type="radio" value="set" :name="`${prefix}-stock-mode`"
                            class="h-4 w-4 border-slate-300 text-indigo-600" />
                        Set exact count
                    </label>
                </div>
            </fieldset>
            <AdminField :id="`${prefix}-stock-value`" :label="stockMode === 'adjust' ? 'Units to add (negative to remove)' : 'New stock count'"
                required :error="save.errors[stockKey]" :hint="stockHint" class="max-w-xs" v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="stockValue" type="number" step="1" inputmode="numeric"
                    :min="stockMode === 'set' ? 0 : -LIMITS.maxStock" :max="LIMITS.maxStock" :class="f.controlClass" />
            </AdminField>
            <div class="flex gap-2">
                <button type="submit" :disabled="save.saving.value" :class="primaryClass">
                    {{ save.saving.value ? "Saving…" : "Update stock" }}
                </button>
                <button type="button" :disabled="save.saving.value" :class="buttonClass" @click="close()">Cancel</button>
            </div>
        </form>
    </li>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from "vue";

import AdminField from "@/components/admin/form/adminField.vue";
import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import VariantFields from "./variantFields.vue";
import { adminCatalogService } from "@/services/adminCatalogService";
import { useAdminSave } from "@/composables/useAdminSave";
import { useFocusFirstError } from "@/composables/useFocusFirstError";
import { formatPrice } from "@/utils/money";
import {
    LIMITS, changedFields, hasErrors, variantErrors, variantFormFrom, variantPayload, wholeNumberError,
} from "@/utils/adminCatalogRules";

const props = defineProps({
    variant: { type: Object, required: true },
    // { price, originalPrice } of the product as strings, for inherited prices.
    productPrices: { type: Object, required: true },
});

const emit = defineEmits(["updated", "dirty"]);

const prefix = `variant-${props.variant.id}`;
const save = useAdminSave();
const panel = ref("");
const panelEl = ref(null);

const buttonClass = "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50 cursor-pointer";
const primaryClass = "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 cursor-pointer";

const optionLabel = computed(() => [props.variant.size, props.variant.color].filter(Boolean).join(" · ") || "One size");

useFocusFirstError(panelEl, () => save.errors);

// ------------------------------------------------------------ panels

const editForm = reactive(variantFormFrom(props.variant));
const stockMode = ref("adjust");
const stockValue = ref("");

const editDirty = computed(() => panel.value === "edit"
    && Object.keys(changedFields(variantPayload(editForm), variantPayload(variantFormFrom(props.variant)))).length > 0);
const stockDirty = computed(() => panel.value === "stock" && String(stockValue.value).trim() !== "");

watch(() => editDirty.value || stockDirty.value, (dirty) => emit("dirty", props.variant.id, dirty), { immediate: true });

async function toggle(name) {
    if (panel.value === name) return close();
    if ((editDirty.value || stockDirty.value) && !window.confirm("Discard the changes in the open form?")) return;

    save.clear();
    Object.assign(editForm, variantFormFrom(props.variant));
    stockValue.value = "";
    stockMode.value = "adjust";
    panel.value = name;

    await nextTick();
    panelEl.value?.querySelector("input:not([type=radio])")?.focus();
}

async function close(keepStatus = false) {
    const opened = panel.value;
    panel.value = "";
    if (!keepStatus) save.clear();

    await nextTick();
    document.getElementById(`${prefix}-${opened}-toggle`)?.focus();
}

const isField = (key) => key in editForm || key === "stock" || key === "stockAdjustment";

async function saveEdit() {
    const errors = variantErrors(editForm, props.productPrices);
    if (hasErrors(errors)) return save.rejectLocally(errors);

    const changes = changedFields(variantPayload(editForm), variantPayload(variantFormFrom(props.variant)));
    if (!Object.keys(changes).length) {
        save.success.value = "No changes to save.";
        return;
    }

    const product = await save.run(() => adminCatalogService.updateVariant(props.variant.id, changes),
        { successMessage: `Variant ${changes.sku ?? props.variant.sku} saved.`, isField });

    if (product) {
        emit("updated", product);
        close(true);
    }
}

// ------------------------------------------------------------ stock

const stockKey = computed(() => (stockMode.value === "adjust" ? "stockAdjustment" : "stock"));

const stockHint = computed(() => {
    const value = Number(stockValue.value);
    if (stockMode.value !== "adjust" || !Number.isInteger(value) || value === 0) return "";
    return `New stock will be ${props.variant.stock + value} (if no orders change it first).`;
});

async function saveStock() {
    const value = String(stockValue.value).trim();
    const error = stockMode.value === "adjust"
        ? wholeNumberError(value, { label: "Units", min: -LIMITS.maxStock, max: LIMITS.maxStock })
            || (Number(value) === 0 ? "Enter a number other than 0" : "")
            || (props.variant.stock + Number(value) < 0 ? `Only ${props.variant.stock} in stock to remove` : "")
        : wholeNumberError(value, { label: "Stock", min: 0, max: LIMITS.maxStock });

    if (error) return save.rejectLocally({ [stockKey.value]: error });

    // Relative changes are applied by the server on the latest count, so a
    // sale that happens meanwhile is not overwritten; "set" replaces it.
    const body = stockMode.value === "adjust" ? { stockAdjustment: Number(value) } : { stock: Number(value) };
    const product = await save.run(() => adminCatalogService.updateVariant(props.variant.id, body),
        { successMessage: `Stock for ${props.variant.sku} updated.`, isField });

    if (product) {
        emit("updated", product);
        close(true);
    }
}

// ------------------------------------------------------------ status

async function toggleActive() {
    if (props.variant.isActive
        && !window.confirm(`Deactivate ${props.variant.sku}? Shoppers can no longer buy it; carts holding it will show it as unavailable.`)) {
        return;
    }

    const product = await save.run(
        () => (props.variant.isActive
            ? adminCatalogService.deactivateVariant(props.variant.id)
            : adminCatalogService.updateVariant(props.variant.id, { isActive: true })),
        { successMessage: `${props.variant.sku} ${props.variant.isActive ? "deactivated" : "activated"}.` },
    );

    if (product) emit("updated", product);
}
</script>
