<template>

    <Header />

    <main id="main-content" tabindex="-1" class="bg-slate-50">

        <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">

            <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">
                Account Settings
            </h1>

            <section v-if="auth.user && !auth.user.emailVerifiedAt"
                class="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 sm:p-6" aria-labelledby="verify-heading">

                <h2 id="verify-heading" class="text-base font-semibold text-amber-900">Verify your email address</h2>
                <p class="mt-1 text-sm text-amber-900">
                    We sent a link to {{ auth.user.email }}. Didn't get it? Check your spam folder or send a new one.
                </p>

                <p role="status" class="mt-2 text-sm font-medium text-amber-900">{{ verification.message }}</p>
                <p v-if="verification.error" role="alert" class="mt-2 text-sm text-red-800">{{ verification.error }}</p>

                <button type="button" :disabled="verification.loading"
                    class="mt-3 rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="handleResendVerification">
                    {{ verification.loading ? "Sending…" : "Resend verification email" }}
                </button>

            </section>

            <section class="mt-6 rounded-xl bg-white p-5 shadow-sm sm:p-8">

                <profileForm v-model:first-name="profile.firstName" v-model:last-name="profile.lastName"
                    v-model:phone="profile.phone" :email="auth.user?.email" :errors="profile.errors"
                    :loading="profile.loading" :success="profile.success" @submit="handleUpdateProfile" />

            </section>

            <section class="mt-6 rounded-xl bg-white p-5 shadow-sm sm:p-8">

                <changePasswordForm v-model:current-password="password.currentPassword"
                    v-model:new-password="password.newPassword" v-model:confirm-password="password.confirmPassword"
                    :errors="password.errors" :loading="password.loading" :success="password.success"
                    @submit="handleChangePassword" />

            </section>

            <section class="mt-6 rounded-xl bg-white p-5 shadow-sm sm:p-8">

                <sessionsPanel :sessions="sessions.list" :loading="sessions.loading" :busy="sessions.busy"
                    :error="sessions.error" :success="sessions.success" @revoke="handleRevokeSession"
                    @revoke-others="handleRevokeOtherSessions" @logout-everywhere="handleLogoutEverywhere" />

            </section>

            <section class="mt-6 rounded-xl border border-red-200 bg-white p-5 shadow-sm sm:p-8">

                <deleteAccountForm v-model:password="deletion.password" v-model:confirmed="deletion.confirmed"
                    :errors="deletion.errors" :loading="deletion.loading" @submit="handleDeleteAccount" />

            </section>

        </div>

    </main>

    <Footer />

</template>

<script setup>
import { watch } from "vue";

import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import profileForm from "@/components/account/profileForm.vue";
import changePasswordForm from "@/components/account/changePasswordForm.vue";
import sessionsPanel from "@/components/account/sessionsPanel.vue";
import deleteAccountForm from "@/components/account/deleteAccountForm.vue";

import { useAccountSettings } from "@/composables/useAccountSettings";
import { useAccountSecurity } from "@/composables/useAccountSecurity";
import { useAuthStore } from "@/stores/authStore";

// requiresAuth guarantees a signed-in user before this page renders.
const auth = useAuthStore();

const {
    profile,
    password,
    handleUpdateProfile,
    handleChangePassword,
} = useAccountSettings();

const {
    verification,
    sessions,
    deletion,
    handleResendVerification,
    handleRevokeSession,
    handleRevokeOtherSessions,
    handleLogoutEverywhere,
    handleDeleteAccount,
    loadSessions,
} = useAccountSecurity();

// A password change signs out the other devices: show the shorter list.
watch(() => password.success, (success) => success && loadSessions());
</script>
