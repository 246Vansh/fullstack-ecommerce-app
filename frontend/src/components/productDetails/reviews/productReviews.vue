<template>
    <section id="reviews" aria-labelledby="reviews-heading" class="scroll-mt-24">

        <h2 id="reviews-heading" tabindex="-1" class="text-2xl font-bold tracking-tight text-gray-900 focus:outline-none">
            Customer reviews
        </h2>

        <div class="mt-8 grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-12">

            <!-- Summary + the customer's own review / form -->
            <div class="lg:col-span-4">

                <ReviewSummary large />

                <div class="mt-8 border-t border-gray-200 pt-8">

                    <h3 class="text-lg font-semibold text-gray-900">
                        {{ mode === "view" || mode === "edit" ? "Your review" : "Share your thoughts" }}
                    </h3>

                    <!-- Success and error messages for the customer's actions -->
                    <p v-if="state.notice" :role="state.notice.type === 'error' ? 'alert' : 'status'"
                        class="mt-4 rounded-md px-4 py-3 text-sm"
                        :class="state.notice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'">
                        {{ state.notice.text }}
                    </p>

                    <div v-if="mode === 'guest'" class="mt-4">
                        <p class="text-sm text-gray-600">Bought this product? Let other shoppers know what you think.</p>

                        <PrimaryButton class="mt-4" variant="outline" :to="loginLink">
                            Sign in to write a review
                        </PrimaryButton>
                    </div>

                    <p v-else-if="mode === 'admin'" class="mt-4 text-sm text-gray-600">
                        Reviews are written by customer accounts.
                    </p>

                    <div v-else-if="mode === 'loading'" class="mt-4 text-gray-400">
                        <LoadingSpinner label="Loading your review" />
                    </div>

                    <div v-else-if="mode === 'error'" class="mt-4">
                        <p role="alert" class="text-sm text-red-600">{{ state.mineError }}</p>

                        <button type="button" class="mt-2 cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-500"
                            @click="reviews.loadMine()">
                            Try again
                        </button>
                    </div>

                    <!-- The customer's own review, with edit and delete -->
                    <div v-else-if="mode === 'view'" class="mt-4">
                        <StarRating :rating="state.mine.rating" size="sm" />

                        <p class="mt-3 whitespace-pre-line break-words text-sm leading-6 text-gray-700">{{ state.mine.body }}</p>

                        <p class="mt-2 text-xs text-gray-500">
                            Posted <time :datetime="state.mine.createdAt">{{ formatReviewDate(state.mine.createdAt) }}</time>
                            <span v-if="state.mine.verifiedPurchase"> · Verified purchase</span>
                        </p>

                        <div v-if="!confirmingDelete" class="mt-4 flex flex-wrap gap-3">
                            <PrimaryButton ref="editButton" tag="button" size="sm" variant="outline" @click="reviews.startEdit()">
                                Edit review
                            </PrimaryButton>

                            <PrimaryButton tag="button" size="sm" variant="outline" @click="askDelete">
                                Delete
                            </PrimaryButton>
                        </div>

                        <!-- Two-step delete: nothing is removed until it is confirmed. -->
                        <div v-else ref="confirmBox" class="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
                            <p class="text-sm font-medium text-red-800">Delete your review? This cannot be undone.</p>

                            <div class="mt-3 flex flex-wrap gap-3">
                                <PrimaryButton tag="button" size="sm" variant="danger" :disabled="state.deleting"
                                    @click="confirmDelete">
                                    {{ state.deleting ? "Deleting…" : "Delete review" }}
                                </PrimaryButton>

                                <PrimaryButton tag="button" size="sm" variant="outline" :disabled="state.deleting"
                                    @click="confirmingDelete = false">
                                    Keep review
                                </PrimaryButton>
                            </div>
                        </div>
                    </div>

                    <!-- New review, or editing the existing one -->
                    <div v-else class="mt-6">
                        <ReviewForm :key="mode" :review="mode === 'edit' ? state.mine : null" :errors="state.formErrors"
                            :submitting="state.submitting" @submit="reviews.submit($event)" @cancel="reviews.cancelEdit()" />
                    </div>

                </div>

            </div>

            <!-- Reviews, newest first -->
            <div class="lg:col-span-8">

                <h3 ref="listHeading" tabindex="-1" class="text-lg font-semibold text-gray-900 focus:outline-none">
                    Most recent reviews
                    <span v-if="state.pagination?.totalPages > 1" class="sr-only">
                        , page {{ state.pagination.page }} of {{ state.pagination.totalPages }}
                    </span>
                </h3>

                <div v-if="state.listLoading && !state.pagination" class="mt-6 flex justify-center py-10 text-gray-400">
                    <LoadingSpinner label="Loading reviews" />
                </div>

                <div v-else-if="state.listError" class="mt-6">
                    <p role="alert" class="text-sm text-red-600">{{ state.listError }}</p>

                    <button type="button" class="mt-2 cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-500"
                        @click="reviews.loadPage(state.pagination?.page ?? 1)">
                        Try again
                    </button>
                </div>

                <p v-else-if="!state.reviews.length" class="mt-6 rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
                    No reviews yet. {{ mode === "admin" ? "" : "Be the first to share your thoughts." }}
                </p>

                <!-- Kept on screen, dimmed, while another page loads. -->
                <div v-else class="mt-6 transition-opacity" :class="state.listLoading ? 'opacity-50' : ''"
                    :aria-busy="state.listLoading ? 'true' : 'false'">
                    <ReviewList :reviews="state.reviews" />

                    <Pagination v-if="state.pagination.totalPages > 1" class="mt-2" :model-value="state.pagination.page"
                        :total-pages="state.pagination.totalPages" @update:model-value="goToPage" />
                </div>

            </div>

        </div>

    </section>
</template>

<script setup>
import { computed, inject, nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

import ReviewSummary from "./reviewSummary.vue";
import ReviewList from "./reviewList.vue";
import ReviewForm from "./reviewForm.vue";
import StarRating from "./starRating.vue";
import Pagination from "@/components/products/pagination.vue";
import PrimaryButton from "@/components/ui/primaryButton.vue";
import LoadingSpinner from "@/components/auth/ui/loadingSpinner.vue";
import { PRODUCT_REVIEWS_KEY } from "@/composables/useProductReviews";
import { formatReviewDate } from "@/utils/reviews";

const reviews = inject(PRODUCT_REVIEWS_KEY);
const { state } = reviews;
const mode = reviews.mode;

const route = useRoute();

const listHeading = ref(null);
const editButton = ref(null);
const confirmBox = ref(null);
const confirmingDelete = ref(false);

// After signing in, come back to this section (see onMounted).
const loginLink = computed(() => ({ name: "login", query: { redirect: `${route.path}#reviews` } }));

async function goToPage(page) {
    await reviews.loadPage(page);

    await nextTick();
    listHeading.value?.focus({ preventScroll: true });
    listHeading.value?.scrollIntoView({ block: "start" });
}

async function askDelete() {
    confirmingDelete.value = true;

    await nextTick();
    confirmBox.value?.querySelector("button")?.focus();
}

async function confirmDelete() {
    const deleted = await reviews.remove();

    confirmingDelete.value = false;

    // The review (and its buttons) are gone: focus the section heading instead.
    if (deleted) {
        await nextTick();
        document.getElementById("reviews-heading")?.focus({ preventScroll: true });
    }
}

// Leaving the form (saved or cancelled) returns focus to "Edit review".
watch(mode, async (next, previous) => {
    if (next !== "view") confirmingDelete.value = false;

    if (previous === "edit" && next === "view") {
        await nextTick();
        editButton.value?.$el?.focus();
    }
});

// The router always scrolls to the top, so a #reviews link (the sign-in
// redirect) is honoured here, once the section exists.
onMounted(async () => {
    if (route.hash !== "#reviews") return;

    await nextTick();
    document.getElementById("reviews")?.scrollIntoView({ block: "start" });
    document.getElementById("reviews-heading")?.focus({ preventScroll: true });
});
</script>
