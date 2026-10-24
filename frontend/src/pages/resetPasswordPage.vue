<template>

    <authLayout :banner="authBanners.resetPassword">

        <resetPasswordForm v-model:password="resetPassword.password"
            v-model:confirm-password="resetPassword.confirmPassword" :errors="resetPassword.errors" :loading="loading"
            :success="resetPassword.success" :has-token="hasToken"
            @submit="handleResetPassword" />

    </authLayout>

</template>

<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";

import authLayout from "@/components/auth/layout/authLayout.vue";
import resetPasswordForm from "@/components/auth/forms/resetPasswordForm.vue";
import { authBanners } from "@/constants/auth/authBanner";
import { useAuth } from "@/composables/useAuth";

const {

    loading,

    resetPassword,

    handleResetPassword,

} = useAuth();

// Read once: useAuth clears resetPassword.token after a successful reset,
// which must not turn the success screen into "invalid link".
const hasToken = Boolean(resetPassword.token);

// useAuth has read the token; keep it out of the address bar and history.
const router = useRouter();

onMounted(() => router.replace({ query: {} }));
</script>