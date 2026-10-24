<template>

    <div ref="rootEl">

        <!-- Always present, so the server's reply is announced when it arrives. -->
        <p role="status" class="sr-only">{{ success }}</p>

        <!-- Done: reset signed out every session, this one included. -->
        <div v-if="success" class="space-y-6">

            <authHeader :title="authPages.resetPasswordDone.title"
                :description="authPages.resetPasswordDone.description" />

            <div class="flex gap-3 rounded-card border border-brand/15 bg-brand-soft p-4 text-sm leading-6 font-medium text-slate-900">
                <CheckCircleIcon class="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <p>{{ success }}</p>
            </div>

            <PrimaryButton :to="ROUTES.LOGIN" full-width>
                Sign in
            </PrimaryButton>

        </div>

        <!-- Opened without a token: nothing to fill in, only a way to get a new link.
             (An expired or used token is only known once submitted: see errors.form.) -->
        <div v-else-if="!hasToken" class="space-y-6">

            <authHeader :title="authPages.resetPasswordInvalid.title"
                :description="authPages.resetPasswordInvalid.description" />

            <PrimaryButton :to="ROUTES.FORGOT_PASSWORD" full-width>
                Request a new reset link
            </PrimaryButton>

            <authFooter text="Remember your password?" link-text="Sign In" :to="ROUTES.LOGIN" />

        </div>

        <form v-else ref="formEl" class="space-y-6" novalidate @submit.prevent="$emit('submit')">

            <authHeader :title="authPages.resetPassword.title" :description="authPages.resetPassword.description" />

            <!-- The 72-byte limit is checked on submit (useAuth and the server) and
                 explained in its error; most passwords never reach it. -->
            <passwordInput id="password" v-model="password" label="New Password" placeholder="Enter your new password"
                autocomplete="new-password" required helper="Use at least 8 characters." :error="errors.password" />

            <passwordInput id="confirm-password" v-model="confirmPassword" label="Confirm Password"
                placeholder="Confirm your password" autocomplete="new-password" required :error="errors.confirmPassword" />

            <div v-if="errors.form" role="alert"
                class="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {{ errors.form }}
                <RouterLink :to="ROUTES.FORGOT_PASSWORD"
                    class="mt-1 block w-fit rounded-sm font-semibold underline underline-offset-4 outline-red-700 focus-visible:outline-2 focus-visible:outline-offset-2">
                    Request a new reset link
                </RouterLink>
            </div>

            <authButton type="submit" :loading="loading">
                Reset Password
            </authButton>

            <authFooter text="Remember your password?" link-text="Sign In" :to="ROUTES.LOGIN" />

        </form>

    </div>

</template>

<script setup>
import { nextTick, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { CheckCircleIcon } from "@heroicons/vue/24/outline";

import authHeader from "../ui/authHeader.vue";
import passwordInput from "../fields/passwordInput.vue";
import authButton from "../ui/authButton.vue";
import authFooter from "../ui/authFooter.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
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

    success: {
        type: String,
        default: "",
    },

    // Whether the page was opened with a ?token= (read once by the page, since
    // useAuth clears the token after a successful reset). Defaults to true so
    // a caller that does not pass it keeps the form.
    hasToken: {
        type: Boolean,
        default: true,
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

// The form (and the button the user pressed) is replaced on success, so focus
// moves to the new heading.
const rootEl = ref(null);

watch(() => Boolean(props.success), async (done) => {
    if (!done) return;

    await nextTick();

    const heading = rootEl.value?.querySelector("h1");

    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
});
</script>
