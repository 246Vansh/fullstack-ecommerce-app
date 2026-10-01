<template>
    <Header />

    <main class="bg-white">
        <div class="mx-auto flex max-w-7xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8">

            <p class="text-sm font-semibold text-indigo-600">404</p>

            <h1 class="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Page Not Found
            </h1>

            <p class="mt-6 max-w-md text-base leading-7 text-gray-600">
                The page you're looking for doesn't exist or may have moved.
            </p>

            <div class="mt-10 flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
                <PrimaryButton :to="{ name: 'home' }" variant="primary">
                    Back to Home
                </PrimaryButton>

                <PrimaryButton :to="{ name: 'products' }" variant="outline">
                    Shop Products
                </PrimaryButton>
            </div>

        </div>
    </main>

    <Footer />
</template>

<script setup>
import Header from "@/components/layout/Header/Header.vue";
import Footer from "@/components/layout/Footer/Footer.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
</script>
