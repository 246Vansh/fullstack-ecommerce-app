<template>
    <!-- Native radio group styled as stars: Tab reaches the group, arrow keys
         change the rating, and each option has a spoken label. -->
    <fieldset>
        <legend class="text-sm font-medium text-gray-900">Your rating</legend>

        <div class="mt-2 flex items-center gap-1" @mouseleave="hovered = 0">

            <label v-for="value in 5" :key="value"
                class="cursor-pointer rounded-sm p-0.5 focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2"
                @mouseenter="hovered = value">

                <input type="radio" class="sr-only" :name="name" :value="value" :checked="modelValue === value"
                    :disabled="disabled" :aria-invalid="error ? 'true' : undefined"
                    :aria-describedby="error ? errorId : undefined" @change="$emit('update:modelValue', value)">

                <StarIcon class="h-7 w-7 transition-colors duration-150"
                    :class="value <= shown ? 'text-amber-400' : 'text-gray-300'" aria-hidden="true" />

                <span class="sr-only">{{ value }} {{ value === 1 ? "star" : "stars" }}</span>

            </label>

            <span class="ml-2 text-sm text-gray-500" aria-hidden="true">
                {{ modelValue ? `${modelValue} of 5` : "Select" }}
            </span>

        </div>

        <p v-if="error" :id="errorId" class="mt-2 text-sm text-red-600">{{ error }}</p>
    </fieldset>
</template>

<script setup>
import { computed, ref } from "vue";
import { StarIcon } from "@heroicons/vue/20/solid";

const props = defineProps({
    modelValue: {
        type: Number,
        default: 0,
    },

    name: {
        type: String,
        default: "review-rating",
    },

    error: {
        type: String,
        default: "",
    },

    disabled: {
        type: Boolean,
        default: false,
    },
});

defineEmits(["update:modelValue"]);

const hovered = ref(0);

const errorId = computed(() => `${props.name}-error`);

// Hover previews a rating; otherwise the chosen one is shown.
const shown = computed(() => (props.disabled ? props.modelValue : hovered.value || props.modelValue));
</script>
