<template>

    <div class="space-y-8">

        <!-- Header -->

        <authHeader :title="authPages.verifyEmail.title" :description="authPages.verifyEmail.description" />

        <!-- Status Card -->

        <div :class="['rounded-card border px-5 py-7 text-center sm:px-6 sm:py-8', STATE_STYLES[state].card]">

            <!-- Icon -->

            <!-- Each state has its own icon as well as colour. -->
            <div :class="['mx-auto flex h-14 w-14 items-center justify-center rounded-full', STATE_STYLES[state].iconBg]">

                <loadingSpinner v-if="state === 'verifying'" :class="STATE_STYLES[state].icon" />

                <component :is="STATE_ICONS[state]" v-else :class="['h-7 w-7', STATE_STYLES[state].icon]" aria-hidden="true" />

            </div>

            <div role="status">

                <h2 class="mt-5 text-lg font-semibold text-slate-900">
                    {{ STATE_TEXT[state].title }}
                </h2>

                <p class="mt-2 text-sm leading-6 text-pretty text-slate-600">
                    {{ STATE_TEXT[state].body }}
                </p>

                <p v-if="resendMessage" class="mt-3 text-sm font-medium text-slate-800">
                    {{ resendMessage }}
                </p>

            </div>

        </div>

        <!-- Actions -->

        <div class="space-y-4">

            <authButton v-if="canResend" type="button" :loading="resending" @click="resend">
                Send a new verification link
            </authButton>

            <!-- The main action once verified; a quieter one while a link is still needed. -->
            <PrimaryButton v-if="state !== 'verifying'" :to="ROUTES.PRODUCTS" full-width
                :variant="state === 'verified' ? 'primary' : 'outline'">
                Continue shopping
            </PrimaryButton>

            <authFooter v-if="!auth.isAuthenticated" text="Have an account?" link-text="Sign In" :to="ROUTES.LOGIN" />

            <authFooter v-else text="Back to" link-text="Account Settings" :to="ROUTES.ACCOUNT" />

        </div>

    </div>

</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import authHeader from "../ui/authHeader.vue";
import authButton from "../ui/authButton.vue";
import authFooter from "../ui/authFooter.vue";
import loadingSpinner from "../ui/loadingSpinner.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import { CheckCircleIcon, EnvelopeIcon, ExclamationTriangleIcon } from "@heroicons/vue/24/outline";

import { ROUTES } from "@/config";
import { authPages } from "@/constants/auth/authPageContent";
import { authService } from "@/services/authService";
import { accountService } from "@/services/accountService";
import { parseApiError } from "@/services/apiClient";
import { useAuthStore } from "@/stores/authStore";

// pending: no link opened (e.g. after sign-up). verifying -> verified | invalid.
const STATE_TEXT = {
    pending: {
        title: "Check your inbox",
        body: "We sent a verification link to your email address. Open it to confirm your address. Didn't get it? Check your spam folder.",
    },
    verifying: {
        title: "Verifying your email…",
        body: "This only takes a moment.",
    },
    verified: {
        title: "Your email is verified",
        body: "Thanks for confirming your email address.",
    },
    invalid: {
        title: "This link is invalid or has expired",
        body: "Verification links work once and expire after 24 hours. Sign in and request a new one.",
    },
};

// Waiting states are warm neutral, success is brand green, failure is red.
const STATE_STYLES = {
    pending: { card: "border-slate-200 bg-surface", iconBg: "bg-white ring-1 ring-slate-200", icon: "text-brand" },
    verifying: { card: "border-slate-200 bg-surface", iconBg: "bg-white ring-1 ring-slate-200", icon: "text-slate-500" },
    verified: { card: "border-brand/20 bg-brand-soft", iconBg: "bg-brand", icon: "text-white" },
    invalid: { card: "border-red-200 bg-red-50", iconBg: "bg-white ring-1 ring-red-200", icon: "text-red-700" },
};

// verifying shows the spinner instead.
const STATE_ICONS = {
    pending: EnvelopeIcon,
    verified: CheckCircleIcon,
    invalid: ExclamationTriangleIcon,
};

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

// Read once, then removed from the address bar and history.
const token = typeof route.query.token === "string" ? route.query.token : "";

const state = ref(token ? "verifying" : "pending");
const resending = ref(false);
const resendMessage = ref("");

const canResend = computed(() => auth.isAuthenticated && !auth.user?.emailVerifiedAt && state.value !== "verified");

onMounted(async () => {
    if (!token) return;

    router.replace({ query: {} });

    try {
        await authService.verifyEmail({ token });

        state.value = "verified";

        if (auth.user) auth.updateUser({ ...auth.user, emailVerifiedAt: new Date().toISOString() });
    } catch {
        state.value = "invalid";
    }
});

async function resend() {
    if (resending.value) return;

    resending.value = true;
    resendMessage.value = "";

    try {
        resendMessage.value = (await accountService.resendVerificationEmail()).message;
    } catch (error) {
        resendMessage.value = parseApiError(error).message;
    } finally {
        resending.value = false;
    }
}
</script>
