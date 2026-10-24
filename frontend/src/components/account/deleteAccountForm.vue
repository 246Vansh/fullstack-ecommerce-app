<template>

    <form ref="formEl" class="space-y-6" novalidate aria-labelledby="delete-heading" @submit.prevent="$emit('submit')">

        <div>
            <h2 id="delete-heading" class="text-xl font-bold text-red-700">Delete Account</h2>
            <p class="mt-1 text-sm text-slate-600">
                Removes your name, email, phone, saved addresses and cart, and signs you out everywhere. Your order
                history is kept for our records and can't be viewed after deletion. This cannot be undone.
            </p>
        </div>

        <passwordInput id="delete-password" v-model="password" label="Your Password" autocomplete="current-password"
            required :error="errors.password" />

        <div>
            <label class="flex items-start gap-3 text-sm text-slate-800">
                <input id="delete-confirm" v-model="confirmed" type="checkbox"
                    class="mt-0.5 h-4 w-4 rounded border-slate-300"
                    :aria-invalid="errors.confirmed ? 'true' : undefined"
                    :aria-describedby="errors.confirmed ? 'delete-confirm-error' : undefined" />
                I understand my account will be permanently deleted.
            </label>
            <p v-if="errors.confirmed" id="delete-confirm-error" class="mt-1 text-sm text-red-700">{{ errors.confirmed }}</p>
        </div>

        <p v-if="errors.form" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {{ errors.form }}
        </p>

        <button type="submit" :disabled="loading"
            class="inline-flex w-full items-center justify-center rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto sm:px-8">
            {{ loading ? "Deleting…" : "Delete My Account" }}
        </button>

    </form>

</template>

<script setup>
import { ref } from "vue";

import passwordInput from "@/components/auth/fields/passwordInput.vue";

import { useFocusFirstError } from "@/composables/useFocusFirstError";

const props = defineProps({

    errors: {
        type: Object,
        default: () => ({}),
    },

    loading: {
        type: Boolean,
        default: false,
    },

});

const password = defineModel("password");

const confirmed = defineModel("confirmed");

defineEmits([
    "submit",
]);

// After a failed submit, focus goes to the first field with an error.
const formEl = ref(null);

useFocusFirstError(formEl, () => props.errors);
</script>
