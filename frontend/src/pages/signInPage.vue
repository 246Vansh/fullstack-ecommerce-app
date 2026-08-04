<template>

    <authLayout :banner="authBanners.signIn">

        <signInForm v-model:email="signIn.email" v-model:password="signIn.password" v-model:remember="signIn.remember"
            :errors="signIn.errors" :loading="loading" @submit="handleSignIn" />

    </authLayout>

</template>

<script setup>
import authLayout from "@/components/auth/layout/authLayout.vue";
import signInForm from "@/components/auth/forms/signInForm.vue";

import { authBanners } from "@/constants/auth/authBanner";

import { useAuth } from "@/composables/useAuth";

const {

    loading,

    signIn,

    handleSignIn,

} = useAuth();
</script>