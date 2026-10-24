<template>
    <!-- One variant's editable fields; `form` is edited in place. `errorKey(name)`
         maps a field to its key in `errors` (e.g. variants[2].sku on create). -->
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

        <AdminField :id="`${prefix}-sku`" label="SKU" required :error="errors[errorKey('sku')]" v-slot="f">
            <input :id="f.id" v-bind="f.attrs" v-model="form.sku" type="text" :maxlength="LIMITS.sku"
                autocomplete="off" spellcheck="false" :class="[f.controlClass, 'font-mono uppercase']" />
        </AdminField>

        <AdminField :id="`${prefix}-size`" label="Size" optional :error="errors[errorKey('size')]" v-slot="f">
            <input :id="f.id" v-bind="f.attrs" v-model="form.size" type="text" :maxlength="LIMITS.size"
                autocomplete="off" :class="f.controlClass" />
        </AdminField>

        <AdminField :id="`${prefix}-color`" label="Color" optional :error="errors[errorKey('color')]" v-slot="f">
            <input :id="f.id" v-bind="f.attrs" v-model="form.color" type="text" :maxlength="LIMITS.color"
                autocomplete="off" :class="f.controlClass" />
        </AdminField>

        <AdminField :id="`${prefix}-color-hex`" label="Color code" optional :error="errors[errorKey('colorHex')]"
            hint="Like #1A2B3C" v-slot="f">
            <div class="flex items-center gap-2">
                <input :id="f.id" v-bind="f.attrs" v-model="form.colorHex" type="text" maxlength="7"
                    autocomplete="off" spellcheck="false" placeholder="#000000" :class="[f.controlClass, 'font-mono uppercase']" />
                <span class="h-11 w-11 shrink-0 rounded-control border border-slate-300" :style="swatch" aria-hidden="true"></span>
            </div>
        </AdminField>

        <AdminField :id="`${prefix}-price`" :label="`Price (${currency})`" optional :error="errors[errorKey('price')]"
            hint="Blank uses the product price" v-slot="f">
            <input :id="f.id" v-bind="f.attrs" v-model="form.price" type="text" inputmode="decimal"
                autocomplete="off" :placeholder="inheritedPrice" :class="f.controlClass" />
        </AdminField>

        <AdminField :id="`${prefix}-original-price`" :label="`Compare-at price (${currency})`" optional
            :error="errors[errorKey('originalPrice')]" hint="Blank uses the product's" v-slot="f">
            <input :id="f.id" v-bind="f.attrs" v-model="form.originalPrice" type="text" inputmode="decimal"
                autocomplete="off" :placeholder="inheritedOriginal" :class="f.controlClass" />
        </AdminField>

        <AdminField v-if="withStock" :id="`${prefix}-stock`" label="Initial stock" required
            :error="errors[errorKey('stock')]" v-slot="f">
            <input :id="f.id" v-bind="f.attrs" v-model="form.stock" type="number" min="0" :max="LIMITS.maxStock"
                step="1" inputmode="numeric" :class="f.controlClass" />
        </AdminField>

    </div>
</template>

<script setup>
import { computed } from "vue";

import AdminField from "@/components/admin/form/adminField.vue";
import { LIMITS } from "@/utils/adminCatalogRules";

const props = defineProps({
    form: { type: Object, required: true },
    errors: { type: Object, required: true },
    prefix: { type: String, required: true },
    errorKey: { type: Function, default: (name) => name },
    withStock: { type: Boolean, default: false },
    // The product's currency: a variant's own prices are in it too.
    currency: { type: String, required: true },
    // The product's prices, shown as placeholders for "inherit".
    inheritedPrice: { type: String, default: "" },
    inheritedOriginal: { type: String, default: "" },
});

const swatch = computed(() => (/^#[0-9a-f]{6}$/i.test(props.form.colorHex.trim())
    ? { backgroundColor: props.form.colorHex.trim() }
    : { backgroundImage: "linear-gradient(135deg, transparent 45%, #cbd5e1 45%, #cbd5e1 55%, transparent 55%)" }));
</script>
