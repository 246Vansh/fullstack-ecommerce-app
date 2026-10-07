<template>

    <checkoutSection number="02" title="Shipping Address" subtitle="Where should we deliver your order?"
        :icon="MapPinIcon" :editable="false">

        <!-- Add / Edit -->

        <addressForm v-if="editing" :key="editing.id ?? 'new'" :address="editing.id ? editing : null"
            :save="(fields) => save(fields, editing.id ?? null)" @saved="editing = null" @cancel="editing = null" />

        <template v-else>

            <p v-if="!addresses.length" class="text-slate-600">
                You have no saved addresses yet. Add one to continue.
            </p>

            <!-- Saved addresses -->

            <div class="space-y-4">

                <div v-for="address in addresses" :key="address.id">

                <label
                    class="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border p-4 transition sm:p-5"
                    :class="address.id === selectedId ? 'border-indigo-500 bg-indigo-50/40' : 'border-gray-200 hover:border-gray-300'">

                    <div class="flex min-w-0 items-start gap-3 sm:gap-4">

                        <input type="radio" name="shipping-address" class="mt-1.5 h-4 w-4 shrink-0" :value="address.id"
                            :checked="address.id === selectedId" @change="$emit('select', address.id)" />

                        <!-- Address -->

                        <div class="min-w-0">

                            <h3 class="text-xl font-semibold text-slate-900">
                                {{ TYPE_LABELS[address.type] ?? address.type }}
                            </h3>

                            <p class="mt-1 font-medium text-slate-700">
                                {{ address.firstName }} {{ address.lastName }} · {{ address.phone }}
                            </p>

                            <p class="mt-2 max-w-xl leading-7 text-slate-600">
                                {{ formatAddress(address) }}
                            </p>

                        </div>

                    </div>

                    <div class="flex shrink-0 flex-col items-end gap-3">

                        <!-- Badge -->

                        <span v-if="address.isDefault"
                            class="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-600">
                            Default
                        </span>

                        <button type="button"
                            class="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer"
                            @click.prevent="editing = address">
                            <PencilSquareIcon class="h-4 w-4" />
                            Edit
                        </button>

                        <button type="button"
                            class="flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 cursor-pointer"
                            @click.prevent="confirmDelete(address.id)">
                            <TrashIcon class="h-4 w-4" />
                            Delete
                        </button>

                    </div>

                </label>

                <!-- Delete confirmation (outside the label so clicks do not select the address) -->
                <div v-if="deletingId === address.id" role="alertdialog" :aria-labelledby="`delete-address-${address.id}`"
                    class="mt-2 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p :id="`delete-address-${address.id}`" class="font-semibold text-slate-900">Delete this address?</p>
                    <p class="mt-1 text-sm text-slate-600">Orders already placed keep their shipping details.</p>
                    <p v-if="deleteError" role="alert" class="mt-2 text-sm font-medium text-red-600">{{ deleteError }}</p>
                    <div class="mt-3 flex flex-wrap gap-3">
                        <button type="button" :disabled="deleting"
                            class="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                            @click="deleteAddress(address.id)">
                            {{ deleting ? "Deleting..." : "Delete" }}
                        </button>
                        <button type="button" :disabled="deleting"
                            class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                            @click="deletingId = null">
                            Keep
                        </button>
                    </div>
                </div>

                </div>

            </div>

            <button type="button"
                class="mt-5 flex items-center gap-2 font-medium text-indigo-600 transition hover:text-indigo-700 cursor-pointer"
                @click="editing = {}">
                <PlusIcon class="h-5 w-5" />
                Add New Address
            </button>

        </template>

    </checkoutSection>

</template>

<script setup>
import { ref } from "vue";
import { MapPinIcon, PencilSquareIcon, PlusIcon, TrashIcon } from "@heroicons/vue/24/outline";

import checkoutSection from "../common/checkoutSection.vue";
import addressForm from "./addressForm.vue";
import { parseApiError } from "@/services/apiClient";

const props = defineProps({
    addresses: {
        type: Array,
        default: () => [],
    },
    selectedId: {
        type: Number,
        default: null,
    },
    // (fields, id | null) => Promise: creates or updates, then selects it.
    save: {
        type: Function,
        required: true,
    },

    // (id) => Promise: deletes it, then reloads the checkout.
    remove: {
        type: Function,
        required: true,
    },
});

defineEmits(["select"]);

const TYPE_LABELS = { HOME: "Home", WORK: "Work", OTHER: "Other" };

// null = list view, {} = adding, an address = editing it.
const editing = ref(null);

// The address awaiting delete confirmation.
const deletingId = ref(null);
const deleting = ref(false);
const deleteError = ref("");

function confirmDelete(id) {
    deletingId.value = id;
    deleteError.value = "";
}

async function deleteAddress(id) {
    if (deleting.value) return;

    deleting.value = true;
    deleteError.value = "";

    try {
        await props.remove(id);
        deletingId.value = null;
    } catch (err) {
        deleteError.value = parseApiError(err).message;
    } finally {
        deleting.value = false;
    }
}

function formatAddress(address) {
    return [address.address, address.apartment, address.city, `${address.state} ${address.zipCode}`, address.country]
        .filter(Boolean)
        .join(", ");
}
</script>
