<template>

    <form class="space-y-6" @submit.prevent="$emit('submit')">

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

        <!-- Terms -->
        <checkboxField id="terms" v-model="acceptTerms" label="I agree to the Terms & Conditions and Privacy Policy"
            required :error="errors.acceptTerms" />

        <!-- Submit -->
        <authButton type="submit" :loading="loading">
            Create Account
        </authButton>

        <!-- Divider -->
        <authDivider />

        <!-- Social Login -->
        <socialLogin :providers="socialProviders" />

        <!-- Footer -->
        <authFooter text="Already have an account?" link-text="Sign In" :to="ROUTES.LOGIN" />

    </form>

</template>

<script setup>
import authHeader from "../ui/authHeader.vue";
import authInput from "../fields/authInput.vue";
import passwordInput from "../fields/passwordInput.vue";
import checkboxField from "../fields/checkboxField.vue";
import authButton from "../ui/authButton.vue";
import authDivider from "../ui/authDivider.vue";
import authFooter from "../ui/authFooter.vue";
import socialButton from "../ui/socialButton.vue";
import socialLogin from "../ui/socialLogin.vue";
import { socialProviders } from "@/constants/auth/socialProviders";
import {ROUTES} from "@/config";

defineProps({

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

const acceptTerms = defineModel("acceptTerms", {
    type: Boolean,
    default: false,
});

defineEmits([
    "submit",
]);
</script>