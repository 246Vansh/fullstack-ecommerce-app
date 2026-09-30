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

                Email verification isn't available yet

            </h3>

            <!-- Description -->

            <p class="mt-3 text-sm leading-6 text-gray-600">

                No verification email is sent and your account doesn't
                need to be verified. You can sign in as usual.

            </p>

        </div>

        <!-- Actions -->

        <div class="space-y-4">

            <!-- Email verification is not implemented; no email is sent. -->

            <authFooter text="Have an account?" link-text="Sign In" :to="ROUTES.LOGIN" />

        </div>

    </div>

</template>

<script setup>
import authHeader from "../ui/authHeader.vue";
import authFooter from "../ui/authFooter.vue";

import { ROUTES } from "@/config";
import { authPages } from "@/constants/auth/authPageContent";

</script>