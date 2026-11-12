<template>
    <form ref="formEl" novalidate class="space-y-4" :aria-label="coupon ? `Edit ${coupon.code}` : 'New coupon'"
        @submit.prevent="submit">
        <AdminFormStatus :alert="save.alert.value" />

        <div class="grid gap-4 sm:grid-cols-2">
            <AdminField :id="`${prefix}-code`" label="Code" required :error="save.errors.code"
                hint="Customers type this at checkout. Letters, numbers, '-' and '_'; saved in capitals." v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.code" type="text" maxlength="40" autocomplete="off"
                    spellcheck="false" autocapitalize="characters" placeholder="WELCOME10"
                    :class="[f.controlClass, 'font-mono uppercase']" />
            </AdminField>

            <AdminField :id="`${prefix}-description`" label="Description" optional :error="save.errors.description"
                hint="Shown to customers next to the code." v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.description" type="text" maxlength="255"
                    autocomplete="off" :class="f.controlClass" />
            </AdminField>

            <AdminField :id="`${prefix}-type`" label="Discount type" required :error="save.errors.discountType" v-slot="f">
                <select :id="f.id" v-bind="f.attrs" v-model="form.discountType" :class="f.controlClass">
                    <option value="PERCENTAGE">Percentage of the order</option>
                    <option value="FIXED">Fixed amount</option>
                </select>
            </AdminField>

            <AdminField :id="`${prefix}-currency`" label="Currency" required :error="save.errors.currency"
                hint="The coupon works only on orders in this currency." v-slot="f">
                <select :id="f.id" v-bind="f.attrs" v-model="form.currency" :class="f.controlClass">
                    <option v-for="currency in COUPON_CURRENCIES" :key="currency" :value="currency">{{ currency }}</option>
                </select>
            </AdminField>

            <AdminField :id="`${prefix}-value`" :label="form.discountType === 'PERCENTAGE' ? 'Discount (%)' : `Discount (${form.currency})`"
                required :error="save.errors.discountValue" v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.discountValue" type="text" inputmode="decimal"
                    autocomplete="off" :placeholder="form.discountType === 'PERCENTAGE' ? '10' : '200.00'" :class="f.controlClass" />
            </AdminField>

            <AdminField v-if="form.discountType === 'PERCENTAGE'" :id="`${prefix}-max`" :label="`Maximum discount (${form.currency})`"
                optional :error="save.errors.maximumDiscountAmount" hint="Caps the percentage discount. Leave empty for no cap." v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.maximumDiscountAmount" type="text" inputmode="decimal"
                    autocomplete="off" :class="f.controlClass" />
            </AdminField>

            <AdminField :id="`${prefix}-min`" :label="`Minimum order (${form.currency})`" optional
                :error="save.errors.minimumOrderAmount" hint="Merchandise subtotal needed, before shipping." v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.minimumOrderAmount" type="text" inputmode="decimal"
                    autocomplete="off" placeholder="0.00" :class="f.controlClass" />
            </AdminField>

            <AdminField :id="`${prefix}-limit`" label="Total uses" optional :error="save.errors.usageLimit"
                :hint="coupon ? `Leave empty for no limit. ${coupon.usedCount} currently held by orders.` : 'Leave empty for no limit.'" v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.usageLimit" type="text" inputmode="numeric"
                    autocomplete="off" :class="f.controlClass" />
            </AdminField>

            <AdminField :id="`${prefix}-per-user`" label="Uses per customer" optional :error="save.errors.usageLimitPerUser"
                hint="Leave empty for no limit." v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.usageLimitPerUser" type="text" inputmode="numeric"
                    autocomplete="off" :class="f.controlClass" />
            </AdminField>

            <AdminField :id="`${prefix}-starts`" label="Starts" :optional="!coupon" :error="save.errors.startsAt"
                :hint="coupon ? 'In your local time.' : 'Leave empty to start now. In your local time.'" v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.startsAt" type="datetime-local" :class="f.controlClass" />
            </AdminField>

            <AdminField :id="`${prefix}-expires`" label="Expires" optional :error="save.errors.expiresAt"
                hint="Leave empty for no expiry. In your local time." v-slot="f">
                <input :id="f.id" v-bind="f.attrs" v-model="form.expiresAt" type="datetime-local" :class="f.controlClass" />
            </AdminField>

            <div class="sm:col-span-2">
                <label class="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-slate-900">
                    <input v-model="form.isActive" type="checkbox"
                        class="h-5 w-5 cursor-pointer rounded accent-brand outline-brand focus-visible:outline-2 focus-visible:outline-offset-2" />
                    Active (customers can apply it)
                </label>
            </div>
        </div>

        <div class="flex flex-wrap gap-2 pt-1">
            <PrimaryButton tag="button" type="submit" size="sm" :loading="save.saving.value">
                {{ save.saving.value ? "Saving…" : coupon ? "Save coupon" : "Create coupon" }}
            </PrimaryButton>
            <PrimaryButton tag="button" variant="outline" size="sm" :disabled="save.saving.value" @click="cancel">
                Cancel
            </PrimaryButton>
        </div>
    </form>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";

import AdminField from "@/components/admin/form/adminField.vue";
import AdminFormStatus from "@/components/admin/form/adminFormStatus.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import { adminCouponService } from "@/services/adminCouponService";
import { useAdminSave } from "@/composables/useAdminSave";
import { useFocusFirstError } from "@/composables/useFocusFirstError";
import { changedFields, hasErrors } from "@/utils/adminCatalogRules";
import { COUPON_CURRENCIES, couponErrors, couponFormFrom, couponPayload, emptyCouponForm } from "@/utils/couponRules";

const props = defineProps({
    // The coupon being edited; null for a new one.
    coupon: { type: Object, default: null },
});

const emit = defineEmits(["saved", "cancel", "dirty"]);

const prefix = props.coupon ? `coupon-${props.coupon.id}` : "new-coupon";
const save = useAdminSave();
const formEl = ref(null);

const initial = () => (props.coupon ? couponFormFrom(props.coupon) : emptyCouponForm());
const form = reactive(initial());
const baseline = couponPayload(initial());

const dirty = computed(() => Object.keys(changedFields(couponPayload(form), baseline)).length > 0);
watch(dirty, (value) => emit("dirty", value), { immediate: true });

useFocusFirstError(formEl, () => save.errors);

const isField = (key) => key in form;

async function submit() {
    const errors = couponErrors(form);
    if (hasErrors(errors)) return save.rejectLocally(errors);

    const payload = couponPayload(form);
    const body = props.coupon ? changedFields(payload, baseline) : payload;

    if (props.coupon && !Object.keys(body).length) return emit("cancel");

    const saved = await save.run(
        () => (props.coupon ? adminCouponService.updateCoupon(props.coupon.id, body) : adminCouponService.createCoupon(body)),
        { isField },
    );

    if (saved) emit("saved", saved);
}

function cancel() {
    if (dirty.value && !window.confirm("Discard the changes to this coupon?")) return;
    emit("cancel");
}

defineExpose({ focus: () => formEl.value?.querySelector("input")?.focus() });
</script>
