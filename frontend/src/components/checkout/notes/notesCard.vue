<template>

    <checkoutSection number="06" title="Order Notes" subtitle="Add any special instructions for your order."
        :icon="ChatBubbleLeftRightIcon" :editable="false">

        <textarea rows="5" placeholder="Example: Please leave the package at the front door, or gift wrap this order..."
            class="w-full resize-none rounded-2xl border border-gray-200 px-5 py-4 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100">
        </textarea>

        <div class="mt-3 flex justify-end">

            <span class="text-sm text-slate-400">
                Optional
            </span>

        </div>

    </checkoutSection>

</template>

<script setup>
import { ChatBubbleLeftRightIcon } from "@heroicons/vue/24/outline";
import checkoutSection from "../common/checkoutSection.vue";
</script>