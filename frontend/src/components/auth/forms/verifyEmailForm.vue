<template>

    <div class="space-y-8">

        <!-- Header -->

        <authHeader :title="authPages.verifyEmail.title" :description="authPages.verifyEmail.description" />

        <!-- Success Card -->

        <div class="rounded-2xl border border-blue-200 bg-blue-50 px-6 py-8 text-center">

            <!-- Icon -->

            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">

                <svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" stroke-width="2"
                    viewBox="0 0 24 24">

                    <path stroke-linecap="round" stroke-linejoin="round"
                        d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />

                </svg>

            </div>

            <!-- Title -->

            <h3 class="mt-6 text-lg font-semibold text-gray-900">

                Check your inbox

            </h3>

            <!-- Description -->

            <p class="mt-3 text-sm leading-6 text-gray-600">

                We've sent a verification email to your registered
                email address.

                Please click the verification link inside the email
                to activate your account.

            </p>

        </div>

        <!-- Information -->

        <div class="rounded-xl border border-amber-200 bg-amber-50 p-5">

            <p class="text-sm leading-6 text-amber-700">

                Didn't receive the email?

                Check your spam or junk folder.

                If it's still missing, you can resend the verification email below.

            </p>

        </div>

        <!-- Actions -->

        <div class="space-y-4">

            <authButton :loading="loading" @click="$emit('resend')">

                Resend Verification Email

            </authButton>

            <authFooter text="Already verified?" link-text="Sign In" :to="ROUTES.LOGIN" />

        </div>

    </div>

</template>

<script setup>
import authHeader from "../ui/authHeader.vue";
import authButton from "../ui/authButton.vue";
import authFooter from "../ui/authFooter.vue";

import { ROUTES } from "@/config";
import { authPages } from "@/constants/auth/authPageContent";

defineProps({

    loading: {
        type: Boolean,
        default: false,

    },

});

defineEmits([
    "resend",
]);
</script>