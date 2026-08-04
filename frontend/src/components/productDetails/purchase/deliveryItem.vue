<template>

    <div class="flex items-start gap-4">

        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg">
            {{ icon }}
        </div>

        <div>

            <h4 class="text-sm font-semibold text-gray-900">
                {{ title }}
            </h4>

            <p class="mt-1 text-sm text-gray-600">
                {{ description }}
            </p>

        </div>

    </div>

</template>

<script setup>
defineProps({
    icon: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
});
</script>