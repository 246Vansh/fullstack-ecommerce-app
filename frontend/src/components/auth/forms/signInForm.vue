<template>

    <form ref="formEl" class="space-y-6" novalidate @submit.prevent="$emit('submit')">

        <authHeader :title="authPages.signIn.title" :description="authPages.signIn.description" />

        <authInput id="email" v-model="email" label="Email Address" type="email" placeholder="Enter your email"
            autocomplete="email" required :error="errors.email" />

        <passwordInput id="password" v-model="password" label="Password" placeholder="Enter your password"
            autocomplete="current-password" required :error="errors.password" />

        <div class="flex items-center justify-between">

            <checkboxField id="remember" v-model="remember" label="Remember me" />

            <RouterLink :to="ROUTES.FORGOT_PASSWORD"
                class="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-brand underline-offset-4 transition-colors hover:text-brand-hover hover:underline outline-brand focus-visible:outline-2 focus-visible:outline-offset-2">
                Forgot password?
            </RouterLink>

        </div>

        <authButton type="submit" :loading="loading">
            Sign In
        </authButton>

        <authFooter text="Don't have an account?" link-text="Create one" :to="ROUTES.REGISTER" />

    </form>

</template>

<script setup>
import { ref } from "vue";
import { RouterLink } from "vue-router";

import authHeader from "../ui/authHeader.vue";
import authInput from "../fields/authInput.vue";
import passwordInput from "../fields/passwordInput.vue";
import checkboxField from "../fields/checkboxField.vue";
import authButton from "../ui/authButton.vue";
import authFooter from "../ui/authFooter.vue";
import { ROUTES } from "@/config";
import { authPages } from "@/constants/auth/authPageContent";
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

const email = defineModel("email");

const password = defineModel("password");

const remember = defineModel("remember", {
    type: Boolean,
    default: false,
});

defineEmits([
    "submit",
]);

// After a failed submit, focus goes to the first field with an error.
const formEl = ref(null);

useFocusFirstError(formEl, () => props.errors);
</script>