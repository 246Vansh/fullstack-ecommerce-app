<template>

    <checkoutSection number="01" title="Contact information" subtitle="The account this order is placed under."
        :icon="UserIcon" :editable="false">

        <!-- The signed-in account; nothing here is editable yet. -->

        <div class="text-sm">

            <p class="font-semibold text-slate-900">
                {{ customerName }}
            </p>

            <div class="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-slate-600">

                <span class="break-all">
                    {{ customer?.email }}
                </span>

                <span v-if="customer?.phone">
                    {{ customer.phone }}
                </span>

            </div>

        </div>

    </checkoutSection>

</template>

<script setup>
import { computed } from "vue";
import { UserIcon } from "@heroicons/vue/24/outline";
import checkoutSection from "../common/checkoutSection.vue";

const props = defineProps({
    // Signed-in user ({ firstName, lastName, email, phone }).
    customer: {
        type: Object,
        default: null,
    },
});

const customerName = computed(() =>
    [props.customer?.firstName, props.customer?.lastName].filter(Boolean).join(" ")
);
</script>
