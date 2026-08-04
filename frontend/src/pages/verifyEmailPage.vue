<template>

    <authLayout :banner="authBanners.verifyEmail">

        <verifyEmailForm :loading="loading" @resend="handleResendVerification" />

    </authLayout>

</template>

<script setup>
import { ref } from "vue";

import authLayout from "@/components/auth/layout/authLayout.vue";
import verifyEmailForm from "@/components/auth/forms/verifyEmailForm.vue";

import { authBanners } from "@/constants/auth/authBanner";

const loading = ref(false);

function handleResendVerification() {

    console.log("Resend Verification Email");

}
</script>