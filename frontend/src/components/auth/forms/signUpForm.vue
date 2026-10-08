<template>

    <form ref="formEl" class="space-y-6" @submit.prevent="$emit('submit')">

        <!-- Header -->
        <authHeader title="Create Your Account"
            description="Join thousands of customers and start your premium shopping experience." />

        <!-- Name -->
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">

            <authInput id="first-name" v-model="firstName" label="First Name" placeholder="John"
                autocomplete="given-name" required :error="errors.firstName" />

            <authInput id="last-name" v-model="lastName" label="Last Name" placeholder="Doe" autocomplete="family-name"
                required :error="errors.lastName" />

        </div>

        <!-- Email -->
        <authInput id="email" v-model="email" label="Email Address" type="email" placeholder="Enter your email"
            autocomplete="email" required :error="errors.email" />

        <!-- Password -->
        <passwordInput id="password" v-model="password" label="Password" placeholder="Create a password"
            autocomplete="new-password" required helper="Use at least 8 characters." :error="errors.password" />

        <!-- Confirm Password -->
        <passwordInput id="confirm-password" v-model="confirmPassword" label="Confirm Password"
            placeholder="Re-enter your password" autocomplete="new-password" required :error="errors.confirmPassword" />

        <!-- No terms checkbox: the store has no Terms & Conditions or Privacy Policy to agree to. -->

        <!-- Submit -->
        <authButton type="submit" :loading="loading">
            Create Account
        </authButton>

        <!-- Footer -->
        <authFooter text="Already have an account?" link-text="Sign In" :to="ROUTES.LOGIN" />

    </form>

</template>

<script setup>
import { ref } from "vue";

import authHeader from "../ui/authHeader.vue";
import authInput from "../fields/authInput.vue";
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

const firstName = defineModel("firstName");

const lastName = defineModel("lastName");

const email = defineModel("email");

const password = defineModel("password");

const confirmPassword = defineModel("confirmPassword");

defineEmits([
    "submit",
]);

// After a failed submit, focus goes to the first field with an error.
const formEl = ref(null);

useFocusFirstError(formEl, () => props.errors);
</script>