<template>

    <authLayout :banner="authBanners.verifyEmail">

        <verifyEmailForm />

    </authLayout>

</template>

<script setup>
import authLayout from "@/components/auth/layout/authLayout.vue";
import verifyEmailForm from "@/components/auth/forms/verifyEmailForm.vue";

import { authBanners } from "@/constants/auth/authBanner";
</script>