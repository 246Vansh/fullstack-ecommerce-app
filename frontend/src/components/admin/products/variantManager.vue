<template>
    <div>
        <ul class="space-y-3">
            <VariantRow v-for="variant in product.variants" :key="variant.id" :variant="variant"
                :product-prices="productPrices" @updated="$emit('updated', $event)" @dirty="setRowDirty" />
        </ul>

        <!-- Add a variant -->
        <div class="mt-4">
            <button v-if="!adding" ref="addButton" type="button"
                class="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-400 hover:bg-slate-50 outline-brand focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                @click="openAdd">
                <PlusIcon class="-ml-1 h-4 w-4" aria-hidden="true" />
                Add variant
            </button>

            <form v-else ref="addForm" novalidate aria-label="New variant"
                class="space-y-4 rounded-control border border-brand/25 bg-brand-soft/50 p-4" @submit.prevent="submitAdd">
                <h3 class="text-sm font-semibold text-slate-900">New variant</h3>
                <AdminFormStatus :alert="save.alert.value" />
                <VariantFields :form="newVariant" :errors="save.errors" prefix="new-variant" with-stock
                    :currency="productPrices.currency"
                    :inherited-price="productPrices.price" :inherited-original="productPrices.originalPrice" />
                <div class="flex flex-wrap gap-2">
                    <PrimaryButton tag="button" type="submit" size="sm" :loading="save.saving.value">
                        {{ save.saving.value ? "Adding…" : "Add variant" }}
                    </PrimaryButton>
                    <PrimaryButton tag="button" variant="outline" size="sm" :disabled="save.saving.value" @click="cancelAdd">
                        Cancel
                    </PrimaryButton>
                </div>
            </form>

            <AdminFormStatus v-if="!adding && save.success.value" class="mt-3" :success="save.success.value" />
        </div>
    </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from "vue";
import { PlusIcon } from "@heroicons/vue/20/solid";

import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
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
    currency: props.product.currency,
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
