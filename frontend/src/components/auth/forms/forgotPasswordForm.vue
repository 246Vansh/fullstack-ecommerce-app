<template>

    <form class="space-y-6" @submit.prevent="$emit('submit')">

        <!-- Header -->

        <authHeader title="Forgot your password?"
            description="Enter your email address and we'll send you a link to reset your password." />

        <!-- Email -->

        <authInput id="email" v-model="email" label="Email Address" type="email" placeholder="Enter your email"
            autocomplete="email" required :error="errors.email" />

        <!-- Submit -->

        <authButton type="submit" :loading="loading">
            Send Reset Link
        </authButton>

        <!-- Footer -->

        <authFooter text="Remember your password?" link-text="Sign In" :to="ROUTES.LOGIN" />

    </form>

</template>

<script setup>
import authHeader from "../ui/authHeader.vue";
import authInput from "../fields/authInput.vue";
import authButton from "../ui/authButton.vue";
import authFooter from "../ui/authFooter.vue";

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

defineEmits([
    "submit",
]);
</script>