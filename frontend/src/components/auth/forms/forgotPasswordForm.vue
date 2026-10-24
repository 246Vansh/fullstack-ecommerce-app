<template>

    <div ref="rootEl">

        <!-- Always present, so the server's reply is announced when it arrives. -->
        <p role="status" class="sr-only">{{ success }}</p>

        <form v-if="!success" ref="formEl" class="space-y-6" novalidate @submit.prevent="$emit('submit')">

            <!-- Header -->

            <authHeader :title="authPages.forgotPassword.title" :description="authPages.forgotPassword.description" />

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

        <!-- Sent: the form is gone, so it cannot be submitted again by accident.
             The message is the server's, which never says whether the address
             has an account. -->
        <div v-else class="space-y-6">

            <authHeader :title="authPages.forgotPasswordSent.title" />

            <div class="flex gap-3 rounded-card border border-brand/15 bg-brand-soft p-4 text-sm leading-6 text-slate-700">
                <EnvelopeIcon class="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <div>
                    <p class="font-medium text-slate-900">{{ success }}</p>
                    <p class="mt-1">
                        The link works once and expires after 30 minutes. If it hasn't arrived in a few minutes,
                        check your spam folder.
                    </p>
                </div>
            </div>

            <PrimaryButton :to="ROUTES.LOGIN" full-width>
                Back to sign in
            </PrimaryButton>

            <p class="text-center text-sm text-slate-600">
                Wrong address?
                <button type="button"
                    class="ml-1 rounded-sm font-semibold text-brand underline decoration-brand/30 underline-offset-4 transition-colors hover:text-brand-hover hover:decoration-current outline-brand focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer"
                    @click="$emit('try-again')">
                    Use a different email address
                </button>
            </p>

        </div>

    </div>

</template>

<script setup>
import { nextTick, ref, watch } from "vue";
import { EnvelopeIcon } from "@heroicons/vue/24/outline";

import authHeader from "../ui/authHeader.vue";
import authInput from "../fields/authInput.vue";
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

});

const email = defineModel("email");

defineEmits([
    "submit",
    // "Use a different email address": the page clears `success` to show the form again.
    "try-again",
]);

// After a failed submit, focus goes to the first field with an error.
const formEl = ref(null);

useFocusFirstError(formEl, () => props.errors);

// The submit button the user was on disappears with the form, so focus moves
// to the new heading (or back to the email field when the form returns).
const rootEl = ref(null);

watch(() => Boolean(props.success), async (sent) => {
    await nextTick();

    const target = sent ? rootEl.value?.querySelector("h1") : rootEl.value?.querySelector("#email");

    if (sent) target?.setAttribute("tabindex", "-1");
    target?.focus();
});
</script>
