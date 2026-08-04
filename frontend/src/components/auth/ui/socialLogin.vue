<template>

    <div class="space-y-3">

        <socialButton v-for="provider in sortedProviders" :key="provider.id" :provider="provider" />

    </div>

</template>

<script setup>
import { computed } from "vue";

import socialButton from "./socialButton.vue";

const props = defineProps({

    providers: {
        type: Array,
        required: true,
    },

});

const sortedProviders = computed(() => {

    return props.providers

        .filter(provider => provider.enabled)

        .sort((a, b) => a.order - b.order);

});
</script>