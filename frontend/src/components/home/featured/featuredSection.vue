<template>
    <section aria-labelledby="cause-heading" class="bg-surface">
        <div class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">

            <div class="rounded-panel bg-brand px-6 py-14 text-center sm:px-12 sm:py-20">

                <h2 id="cause-heading" class="text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
                    Looking for something specific?
                </h2>

                <!-- What the catalog's search and filters actually do (see useProducts). -->
                <p class="mx-auto mt-4 max-w-2xl text-lg leading-8 text-pretty text-white/85">
                    Search by product name, brand or description, then narrow the results by
                    category, size, colour and price, and sort by newest, best selling or price.
                </p>

                <PrimaryButton to="/products" variant="light" size="lg" class="mt-8">
                    Browse the catalog
                </PrimaryButton>

            </div>

        </div>
    </section>
</template>

<script setup>
import PrimaryButton from "@/components/ui/primaryButton.vue";
</script>
