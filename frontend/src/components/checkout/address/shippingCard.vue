<template>

    <checkoutSection number="02" title="Shipping Address" subtitle="Where should we deliver your order?"
        :icon="MapPinIcon" :editable="false">

        <!-- Add / Edit -->

        <addressForm v-if="editing" :key="editing.id ?? 'new'" :address="editing.id ? editing : null"
            :save="(fields) => save(fields, editing.id ?? null)" @saved="closeForm" @cancel="closeForm" />

        <template v-else>

            <p v-if="!addresses.length" class="text-slate-600">
                You have no saved addresses yet. Add one to continue.
            </p>

            <!-- Saved addresses. Only the radio and its address text are the label;
                 Edit and Delete sit beside it so they are not part of the radio. -->

            <fieldset v-if="addresses.length" class="space-y-4">

                <legend class="sr-only">Choose a shipping address</legend>

                <div v-for="address in addresses" :key="address.id" :data-address-card="address.id">

                <div class="flex items-start justify-between gap-4 rounded-2xl border p-4 transition sm:p-5"
                    :class="address.id === selectedId ? 'border-indigo-500 bg-indigo-50/40' : 'border-gray-200 hover:border-gray-300'">

                    <label :for="`shipping-address-${address.id}`"
                        class="flex min-w-0 flex-1 cursor-pointer items-start gap-3 sm:gap-4">

                        <input :id="`shipping-address-${address.id}`" type="radio" name="shipping-address"
                            class="mt-1.5 h-4 w-4 shrink-0" :value="address.id"
                            :checked="address.id === selectedId" @change="$emit('select', address.id)" />

                        <!-- Address -->

                        <div :id="`shipping-address-summary-${address.id}`" class="min-w-0">

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

                    </label>

                    <div class="flex shrink-0 flex-col items-end gap-3">

                        <!-- Badge -->

                        <span v-if="address.isDefault"
                            class="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-600">
                            Default
                        </span>

                        <button :id="`edit-address-${address.id}`" type="button"
                            :aria-describedby="`shipping-address-summary-${address.id}`"
                            class="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer"
                            @click="openForm(address, `edit-address-${address.id}`)">
                            <PencilSquareIcon class="h-4 w-4" />
                            Edit
                        </button>

                        <button :id="`delete-address-button-${address.id}`" type="button"
                            :aria-describedby="`shipping-address-summary-${address.id}`"
                            class="flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 cursor-pointer"
                            @click="confirmDelete(address.id)">
                            <TrashIcon class="h-4 w-4" />
                            Delete
                        </button>

                    </div>

                </div>

                <!-- Delete confirmation -->
                <div v-if="deletingId === address.id" role="alertdialog" :aria-labelledby="`delete-address-${address.id}`"
                    :aria-describedby="`delete-address-note-${address.id}`"
                    class="mt-2 rounded-2xl border border-red-200 bg-red-50 p-4">
                    <p :id="`delete-address-${address.id}`" class="font-semibold text-slate-900">Delete this address?</p>
                    <p :id="`delete-address-note-${address.id}`" class="mt-1 text-sm text-slate-600">Orders already placed keep their shipping details.</p>
                    <p v-if="deleteError" role="alert" class="mt-2 text-sm font-medium text-red-600">{{ deleteError }}</p>
                    <div class="mt-3 flex flex-wrap gap-3">
                        <button type="button" :disabled="deleting"
                            class="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                            @click="deleteAddress(address.id)">
                            {{ deleting ? "Deleting..." : "Delete" }}
                        </button>
                        <button :id="`keep-address-${address.id}`" type="button" :disabled="deleting"
                            class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                            @click="cancelDelete(address.id)">
                            Keep
                        </button>
                    </div>
                </div>

                </div>

            </fieldset>

            <button id="add-address" type="button"
                class="mt-5 flex items-center gap-2 font-medium text-indigo-600 transition hover:text-indigo-700 cursor-pointer"
                @click="openForm({}, 'add-address')">
                <PlusIcon class="h-5 w-5" />
                Add New Address
            </button>

        </template>

    </checkoutSection>

</template>

<script setup>
import { nextTick, ref } from "vue";
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

// The button that opened the form; focus returns to it when the form closes.
let returnFocusId = null;

async function focusById(id) {
    await nextTick();
    (document.getElementById(id) ?? document.getElementById("add-address"))?.focus();
}

function openForm(address, triggerId) {
    returnFocusId = triggerId;
    editing.value = address;
}

function closeForm() {
    editing.value = null;
    focusById(returnFocusId);
}

// The address awaiting delete confirmation.
const deletingId = ref(null);
const deleting = ref(false);
const deleteError = ref("");

// Focus starts on the safe choice (Keep) and goes back to the address's Delete button.
function confirmDelete(id) {
    deletingId.value = id;
    deleteError.value = "";
    focusById(`keep-address-${id}`);
}

function cancelDelete(id) {
    deletingId.value = null;
    focusById(`delete-address-button-${id}`);
}

async function deleteAddress(id) {
    if (deleting.value) return;

    deleting.value = true;
    deleteError.value = "";

    try {
        await props.remove(id);
        deletingId.value = null;
        focusById("add-address");
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
