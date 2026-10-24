<template>
    <form ref="formRef" class="space-y-6" novalidate @submit.prevent="submit">

        <StarRatingInput v-model="rating" :error="errors.rating" :disabled="submitting" />

        <div>
            <label for="review-body" class="block text-sm font-medium text-gray-900">Your review</label>

            <textarea id="review-body" v-model="body" rows="5" :disabled="submitting"
                placeholder="What did you like or dislike? How was the fit and quality?"
                :aria-invalid="errors.body ? 'true' : undefined"
                :aria-describedby="errors.body ? 'review-body-error review-body-count' : 'review-body-count'"
                class="mt-2 block w-full rounded-md border px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:bg-gray-50"
                :class="errors.body
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-brand focus:ring-brand'" />

            <div class="mt-2 flex items-start justify-between gap-4 text-sm">
                <p v-if="errors.body" id="review-body-error" class="text-red-600">{{ errors.body }}</p>
                <span v-else />

                <!-- Counted as the server counts: trimmed, in characters (code points). -->
                <p id="review-body-count" class="shrink-0 tabular-nums"
                    :class="length > REVIEW_BODY.max ? 'text-red-600' : 'text-gray-500'">
                    {{ length.toLocaleString("en-US") }} / {{ REVIEW_BODY.max.toLocaleString("en-US") }}
                    <span class="sr-only">characters</span>
                </p>
            </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
            <PrimaryButton tag="button" type="submit" :disabled="submitting">
                <LoadingSpinner v-if="submitting" class="mr-2" />
                {{ submitting ? "Saving…" : review ? "Update review" : "Submit review" }}
            </PrimaryButton>

            <PrimaryButton v-if="review" tag="button" variant="outline" :disabled="submitting" @click="$emit('cancel')">
                Cancel
            </PrimaryButton>
        </div>

    </form>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from "vue";

import StarRatingInput from "./starRatingInput.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import { useFocusFirstError } from "@/composables/useFocusFirstError";
import { REVIEW_BODY, textLength } from "@/utils/reviews";

const props = defineProps({
    // The customer's existing review when editing; null when writing a new one.
    review: {
        type: Object,
        default: null,
    },

    errors: {
        type: Object,
        default: () => ({}),
    },

    submitting: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(["submit", "cancel"]);

const formRef = ref(null);

const rating = ref(props.review?.rating ?? 0);
const body = ref(props.review?.body ?? "");

const length = computed(() => textLength(body.value.trim()));

useFocusFirstError(formRef, () => props.errors);

// Editing starts on the rating, so keyboard users land in the form.
onMounted(async () => {
    if (!props.review) return;

    await nextTick();
    formRef.value?.querySelector("input[type='radio']:checked")?.focus();
});

function submit() {
    emit("submit", { rating: rating.value, body: body.value });
}
</script>
