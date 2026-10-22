<template>

    <Header />

    <main id="main-content" tabindex="-1" class="bg-slate-50">

        <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6">

            <h1 class="text-3xl font-extrabold tracking-tight text-slate-900">
                Account Settings
            </h1>

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

        </div>

    </main>

    <Footer />

</template>

<script setup>
import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import profileForm from "@/components/account/profileForm.vue";
import changePasswordForm from "@/components/account/changePasswordForm.vue";

import { useAccountSettings } from "@/composables/useAccountSettings";
import { useAuthStore } from "@/stores/authStore";

// requiresAuth guarantees a signed-in user before this page renders.
const auth = useAuthStore();

const {
    profile,
    password,
    handleUpdateProfile,
    handleChangePassword,
} = useAccountSettings();
</script>
