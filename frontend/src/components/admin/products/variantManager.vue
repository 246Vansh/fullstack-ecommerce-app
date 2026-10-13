<template>
    <div>
        <ul class="space-y-3">
            <VariantRow v-for="variant in product.variants" :key="variant.id" :variant="variant"
                :product-prices="productPrices" @updated="$emit('updated', $event)" @dirty="setRowDirty" />
        </ul>

        <!-- Add a variant -->
        <div class="mt-4">
            <button v-if="!adding" ref="addButton" type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer"
                @click="openAdd">
                <PlusIcon class="h-4 w-4" aria-hidden="true" />
                Add variant
            </button>

            <form v-else ref="addForm" novalidate aria-label="New variant"
                class="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3" @submit.prevent="submitAdd">
                <h3 class="text-sm font-semibold text-slate-900">New variant</h3>
                <AdminFormStatus :alert="save.alert.value" />
                <VariantFields :form="newVariant" :errors="save.errors" prefix="new-variant" with-stock
                    :inherited-price="productPrices.price" :inherited-original="productPrices.originalPrice" />
                <div class="flex gap-2">
                    <button type="submit" :disabled="save.saving.value"
                        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 cursor-pointer">
                        {{ save.saving.value ? "Adding…" : "Add variant" }}
                    </button>
                    <button type="button" :disabled="save.saving.value"
                        class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600 cursor-pointer"
                        @click="cancelAdd">
                        Cancel
                    </button>
                </div>
            </form>

            <p v-if="!adding && save.success.value" role="status" class="mt-2 text-sm font-medium text-green-800">
                {{ save.success.value }}
            </p>
        </div>
    </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from "vue";
import { PlusIcon } from "@heroicons/vue/20/solid";

import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import VariantFields from "./variantFields.vue";
import VariantRow from "./variantRow.vue";
import { adminCatalogService } from "@/services/adminCatalogService";
import { useAdminSave } from "@/composables/useAdminSave";
import { useFocusFirstError } from "@/composables/useFocusFirstError";
import { emptyVariantForm, hasErrors, variantErrors, variantPayload } from "@/utils/adminCatalogRules";

const props = defineProps({
    product: { type: Object, required: true },
});

const emit = defineEmits(["updated", "dirty"]);

const productPrices = computed(() => ({
    price: Number(props.product.price).toFixed(2),
    originalPrice: props.product.originalPrice == null ? "" : Number(props.product.originalPrice).toFixed(2),
}));

// ------------------------------------------------------------ dirty tracking

const dirtyRows = reactive(new Set());
const setRowDirty = (id, dirty) => (dirty ? dirtyRows.add(id) : dirtyRows.delete(id));

const adding = ref(false);
const newVariant = reactive(emptyVariantForm());
const addDirty = computed(() => adding.value && JSON.stringify(newVariant) !== JSON.stringify(emptyVariantForm()));

watch(() => dirtyRows.size > 0 || addDirty.value, (dirty) => emit("dirty", dirty), { immediate: true });

// ------------------------------------------------------------ add

const save = useAdminSave();
const addForm = ref(null);
const addButton = ref(null);

useFocusFirstError(addForm, () => save.errors);

async function openAdd() {
    save.clear();
    Object.assign(newVariant, emptyVariantForm());
    adding.value = true;

    await nextTick();
    addForm.value?.querySelector("input")?.focus();
}

async function cancelAdd() {
    if (addDirty.value && !window.confirm("Discard this new variant?")) return;

    adding.value = false;
    save.clear();

    await nextTick();
    addButton.value?.focus();
}

async function submitAdd() {
    const errors = variantErrors(newVariant, productPrices.value, { withStock: true });
    if (hasErrors(errors)) return save.rejectLocally(errors);

    const payload = variantPayload(newVariant, { withStock: true });
    const product = await save.run(() => adminCatalogService.createVariant(props.product.id, payload), {
        successMessage: `Variant ${payload.sku} added.`,
        isField: (key) => key in newVariant,
    });

    if (product) {
        emit("updated", product);
        adding.value = false;

        await nextTick();
        addButton.value?.focus();
    }
}
</script>
