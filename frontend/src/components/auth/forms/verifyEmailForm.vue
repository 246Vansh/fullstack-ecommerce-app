<template>

    <div class="space-y-8">

        <!-- Header -->

        <authHeader :title="authPages.verifyEmail.title" :description="authPages.verifyEmail.description" />

        <!-- Status Card -->

        <div :class="['rounded-2xl border px-6 py-8 text-center', STATE_STYLES[state].card]">

            <!-- Icon -->

            <div :class="['mx-auto flex h-16 w-16 items-center justify-center rounded-full', STATE_STYLES[state].iconBg]">

                <svg :class="['h-8 w-8', STATE_STYLES[state].icon]" aria-hidden="true" fill="none" stroke="currentColor"
                    stroke-width="2" viewBox="0 0 24 24">

                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />

                </svg>

            </div>

            <div role="status">

                <h2 class="mt-6 text-lg font-semibold text-gray-900">
                    {{ STATE_TEXT[state].title }}
                </h2>

                <p class="mt-3 text-sm leading-6 text-gray-600">
                    {{ STATE_TEXT[state].body }}
                </p>

                <p v-if="resendMessage" class="mt-3 text-sm font-medium text-gray-800">
                    {{ resendMessage }}
                </p>

            </div>

        </div>

        <!-- Actions -->

        <div class="space-y-4">

            <authButton v-if="canResend" type="button" :loading="resending" @click="resend">
                Send a new verification link
            </authButton>

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

const STATE_STYLES = {
    pending: { card: "border-blue-200 bg-blue-50", iconBg: "bg-blue-100", icon: "text-blue-600" },
    verifying: { card: "border-blue-200 bg-blue-50", iconBg: "bg-blue-100", icon: "text-blue-600" },
    verified: { card: "border-green-200 bg-green-50", iconBg: "bg-green-100", icon: "text-green-600" },
    invalid: { card: "border-red-200 bg-red-50", iconBg: "bg-red-100", icon: "text-red-600" },
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
