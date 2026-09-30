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

                <label v-for="address in addresses" :key="address.id"
                    class="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border p-5 transition"
                    :class="address.id === selectedId ? 'border-indigo-500 bg-indigo-50/40' : 'border-gray-200 hover:border-gray-300'">

                    <div class="flex items-start gap-4">

                        <input type="radio" name="shipping-address" class="mt-1.5 h-4 w-4" :value="address.id"
                            :checked="address.id === selectedId" @change="$emit('select', address.id)" />

                        <!-- Address -->

                        <div>

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

                    </div>

                </label>

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
import { MapPinIcon, PencilSquareIcon, PlusIcon } from "@heroicons/vue/24/outline";

import checkoutSection from "../common/checkoutSection.vue";
import addressForm from "./addressForm.vue";

defineProps({
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
});

defineEmits(["select"]);

const TYPE_LABELS = { HOME: "Home", WORK: "Work", OTHER: "Other" };

// null = list view, {} = adding, an address = editing it.
const editing = ref(null);

function formatAddress(address) {
    return [address.address, address.apartment, address.city, `${address.state} ${address.zipCode}`, address.country]
        .filter(Boolean)
        .join(", ");
}
</script>
