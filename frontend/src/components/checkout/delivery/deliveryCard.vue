<template>

    <checkoutSection number="03" title="Delivery Method" subtitle="Choose your preferred delivery option."
        :icon="TruckIcon">

        <div class="grid gap-5 md:grid-cols-2">

            <deliveryOption v-for="option in options" :key="option.id" :option="option"
                :selected="selected === option.id" @select="selected = option.id" />

        </div>

    </checkoutSection>

</template>

<script setup>
import { ref } from "vue";

import {
    CubeIcon,
    RocketLaunchIcon,
    TruckIcon,
} from "@heroicons/vue/24/outline";

import checkoutSection from "../common/checkoutSection.vue";
import deliveryOption from "./deliveryOption.vue";

const selected = ref(1);

const options = [

    {
        id: 1,
        name: "Standard Delivery",
        description: "3–5 business days",
        price: "Free",
        icon: CubeIcon,
    },

    {
        id: 2,
        name: "Express Delivery",
        description: "1–2 business days",
        price: "$9.99",
        icon: RocketLaunchIcon,
    },

];
</script>