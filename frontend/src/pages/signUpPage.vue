<template>

    <authLayout :banner="authBanners.signUp">

        <signUpForm v-model:first-name="signUp.firstName" v-model:last-name="signUp.lastName"
            v-model:email="signUp.email" v-model:password="signUp.password"
            v-model:confirm-password="signUp.confirmPassword" v-model:accept-terms="signUp.acceptTerms"
            :errors="signUp.errors" :loading="loading" @submit="handleSignUp" />

    </authLayout>

</template>

<script setup>
import authLayout from "@/components/auth/layout/authLayout.vue";
import signUpForm from "@/components/auth/forms/signUpForm.vue";
import { authBanners } from "@/constants/auth/authBanner";
import { useAuth } from "@/composables/useAuth";

const {

    loading,

    signUp,

    handleSignUp,

} = useAuth();
</script>