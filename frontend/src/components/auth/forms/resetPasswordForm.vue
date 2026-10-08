<template>

    <form ref="formEl" class="space-y-6" @submit.prevent="$emit('submit')">

        <authHeader title="Reset Password" description="Create a new password for your account." />

        <passwordInput id="password" v-model="password" label="New Password" placeholder="Enter your new password"
            autocomplete="new-password" required :error="errors.password" />

        <passwordInput id="confirm-password" v-model="confirmPassword" label="Confirm Password"
            placeholder="Confirm your password" autocomplete="new-password" required :error="errors.confirmPassword" />

        <authButton type="submit" :loading="loading">
            Reset Password
        </authButton>

        <authFooter text="Remember your password?" link-text="Sign In" :to="ROUTES.LOGIN" />

    </form>

</template>

<script setup>
import { ref } from "vue";

import authHeader from "../ui/authHeader.vue";
import passwordInput from "../fields/passwordInput.vue";
import authButton from "../ui/authButton.vue";
import authFooter from "../ui/authFooter.vue";

import { ROUTES } from "@/config";
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

const confirmPassword = defineModel("confirmPassword");

defineEmits([
    "submit",
]);

// After a failed submit, focus goes to the first field with an error.
const formEl = ref(null);

useFocusFirstError(formEl, () => props.errors);
</script>