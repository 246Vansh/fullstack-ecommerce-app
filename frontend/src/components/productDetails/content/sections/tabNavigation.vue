<template>
    <!-- WAI-ARIA tabs: only the selected tab is in the Tab order; arrow keys,
         Home and End move between tabs and select them. -->
    <div role="tablist" aria-label="Product information" class="-mx-4 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0"
        @keydown="onKeydown">
        <ul role="presentation" class="flex gap-6 sm:gap-8">

            <li v-for="tab in tabs" :key="tab.id" role="presentation">
                <button :id="tabId(tab.id)" ref="buttons" type="button" role="tab"
                    :aria-selected="activeTab === tab.id"
                    :aria-controls="activeTab === tab.id ? panelId(tab.id) : undefined"
                    :tabindex="activeTab === tab.id ? 0 : -1"
                    class="relative min-h-12 rounded-sm text-sm font-semibold whitespace-nowrap transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand" :class="[
                    activeTab === tab.id
                        ? 'text-slate-900'
                        : 'text-slate-500 hover:text-slate-900'
                ]" @click="$emit('change-tab', tab.id)">
                    {{ tab.label }}

                    <span v-if="activeTab === tab.id" class="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-brand" aria-hidden="true" />
                </button>
            </li>

        </ul>
    </div>
</template>

<script setup>
import { nextTick, ref } from "vue";

const props = defineProps({
    tabs: {
        type: Array,
        required: true,
    },

    activeTab: {
        type: String,
        required: true,
    },
});

const emit = defineEmits(["change-tab"]);

const buttons = ref([]);

// Shared with the panel in productContent, which uses the same ids.
const tabId = (id) => `product-tab-${id}`;
const panelId = (id) => `product-panel-${id}`;

const KEY_STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

async function onKeydown(event) {
    const current = props.tabs.findIndex((tab) => tab.id === props.activeTab);
    const last = props.tabs.length - 1;

    let next;

    if (event.key in KEY_STEPS) next = (current + KEY_STEPS[event.key] + props.tabs.length) % props.tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;

    event.preventDefault();
    emit("change-tab", props.tabs[next].id);

    await nextTick();
    buttons.value.find((button) => button.id === tabId(props.tabs[next].id))?.focus();
}
</script>
