<template>

    <form ref="formEl" class="space-y-6" @submit.prevent="$emit('submit')">

        <!-- Header -->

        <authHeader title="Forgot your password?"
            description="Enter your email address and we'll send you a link to reset your password." />

        <!-- Email -->

        <authInput id="email" v-model="email" label="Email Address" type="email" placeholder="Enter your email"
            autocomplete="email" required :error="errors.email" />

        <p role="status" :class="success ? 'rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800' : 'sr-only'">
            {{ success }}
        </p>

        <!-- Submit -->

        <authButton type="submit" :loading="loading">
            Send Reset Link
        </authButton>

        <!-- Footer -->

        <authFooter text="Remember your password?" link-text="Sign In" :to="ROUTES.LOGIN" />

    </form>

</template>

<script setup>
import { ref } from "vue";

import authHeader from "../ui/authHeader.vue";
import authInput from "../fields/authInput.vue";
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

    success: {
        type: String,
        default: "",
    },

});

const email = defineModel("email");

defineEmits([
    "submit",
]);

// After a failed submit, focus goes to the first field with an error.
const formEl = ref(null);

useFocusFirstError(formEl, () => props.errors);
</script>