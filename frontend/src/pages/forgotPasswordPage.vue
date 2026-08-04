<template>

    <authLayout :banner="authBanners.forgotPassword">

        <forgotPasswordForm v-model:email="forgotPassword.email" :errors="forgotPassword.errors" :loading="loading"
            @submit="handleForgotPassword" />

    </authLayout>

</template>

<script setup>
import authLayout from "@/components/auth/layout/authLayout.vue";
import forgotPasswordForm from "@/components/auth/forms/forgotPasswordForm.vue";
import { authBanners } from "@/constants/auth/authBanner";
import { useAuth } from "@/composables/useAuth";

const {

    loading,

    forgotPassword,

    handleForgotPassword,

} = useAuth();
</script>