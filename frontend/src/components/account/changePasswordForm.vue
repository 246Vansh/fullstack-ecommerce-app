<template>

    <form ref="formEl" class="space-y-6" novalidate aria-labelledby="password-heading" @submit.prevent="$emit('submit')">

        <div>
            <h2 id="password-heading" class="text-xl font-bold text-slate-900">Change Password</h2>
            <p class="mt-1 text-sm text-slate-600">Changing your password signs you out on your other devices.</p>
        </div>

        <passwordInput id="current-password" v-model="currentPassword" label="Current Password"
            autocomplete="current-password" required :error="errors.currentPassword" />

        <passwordInput id="new-password" v-model="newPassword" label="New Password" autocomplete="new-password"
            helper="At least 8 characters." required :error="errors.newPassword" />

        <passwordInput id="confirm-new-password" v-model="confirmPassword" label="Confirm New Password"
            autocomplete="new-password" required :error="errors.confirmPassword" />

        <p v-if="errors.form" role="alert" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {{ errors.form }}
        </p>

        <p role="status" :class="success ? 'rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800' : 'sr-only'">
            {{ success }}
        </p>

        <authButton type="submit" :loading="loading" class="sm:w-auto sm:px-8">
            Change Password
        </authButton>

    </form>

</template>

<script setup>
import { ref } from "vue";

import passwordInput from "@/components/auth/fields/passwordInput.vue";
import authButton from "@/components/auth/ui/authButton.vue";

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

    success: {
        type: String,
        default: "",
    },

});

const currentPassword = defineModel("currentPassword");

const newPassword = defineModel("newPassword");

const confirmPassword = defineModel("confirmPassword");

defineEmits([
    "submit",
]);

// After a failed submit, focus goes to the first field with an error.
const formEl = ref(null);

useFocusFirstError(formEl, () => props.errors);
</script>
