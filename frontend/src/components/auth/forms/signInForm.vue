<template>

    <form class="space-y-6" @submit.prevent="$emit('submit')">

        <authHeader title="Welcome Back" description="Sign in to your account to continue shopping." />

        <authInput id="email" v-model="email" label="Email Address" type="email" placeholder="Enter your email"
            autocomplete="email" required :error="errors.email" />

        <passwordInput id="password" v-model="password" label="Password" placeholder="Enter your password"
            autocomplete="current-password" required :error="errors.password" />

        <div class="flex items-center justify-between">

            <checkboxField id="remember" v-model="remember" label="Remember me" />

            <authLink :to="ROUTES.FORGOT_PASSWORD">
                Forgot password?
            </authLink>

        </div>

        <authButton type="submit" :loading="loading">
            Sign In
        </authButton>

        <authDivider />

        <socialLogin :providers="socialProviders" />

        <authFooter text="Don't have an account?" link-text="Create one" :to="ROUTES.REGISTER" />

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
import authLink from "../ui/authLink.vue";
import socialLogin from "../ui/socialLogin.vue";
import { socialProviders } from "@/constants/auth/socialProviders";
import { ROUTES } from "@/config";

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

const email = defineModel("email");

const password = defineModel("password");

const remember = defineModel("remember", {
    type: Boolean,
    default: false,
});

defineEmits([
    "submit",
]);
</script>