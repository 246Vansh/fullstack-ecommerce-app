<template>

    <authLayout :banner="authBanners.resetPassword">

        <resetPasswordForm v-model:password="resetPassword.password"
            v-model:confirm-password="resetPassword.confirmPassword" :errors="resetPassword.errors" :loading="loading"
            @submit="handleResetPassword" />

    </authLayout>

</template>

<script setup>
import authLayout from "@/components/auth/layout/authLayout.vue";
import resetPasswordForm from "@/components/auth/forms/resetPasswordForm.vue";
import { authBanners } from "@/constants/auth/authBanner";
import { useAuth } from "@/composables/useAuth";

const {

    loading,

    resetPassword,

    handleResetPassword,

} = useAuth();
</script>