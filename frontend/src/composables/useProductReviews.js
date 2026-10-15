import { computed, reactive, readonly } from "vue";

import {
    REVIEW_PAGE_SIZE,
    reviewErrorMessage,
    reviewFieldErrors,
    validateReview,
} from "../utils/reviews.js";

// Provided by ProductDetails, injected by the review components.
export const PRODUCT_REVIEWS_KEY = Symbol("productReviews");

const LIST_ERROR = "We couldn't load reviews. Please try again.";
const MINE_ERROR = "We couldn't load your review. Please try again.";

/*
| Review state for one product page. The service (reviewService) and error
| parser (parseApiError) are passed in, so tests can use fakes and this file
| has no "@/" imports.
|
| - viewer is { id, role } or null. Only customers ever request /mine; guests
|   and admins never do (the API answers 403 for admins).
| - Every list and /mine request has a sequence number, and only the latest
|   one may write state; superseded requests are also aborted.
| - load() (new product) and setViewer() (sign-in, sign-out, another account)
|   start a new generation: a create/update/delete still in flight for the
|   previous product or viewer is ignored when it settles.
| - After dispose() (page left) nothing writes state.
*/
export function useProductReviews({ service, parseError = (error) => error, pageSize = REVIEW_PAGE_SIZE }) {

    const state = reactive({
        productId: null,
        viewer: null,

        reviews: [],
        summary: null,
        pagination: null,
        listLoading: false,
        listError: "",

        mine: null,
        mineLoaded: false,
        mineLoading: false,
        mineError: "",

        editing: false,
        submitting: false,
        deleting: false,
        formErrors: {},
        notice: null, // { type: "success" | "error", text }
    });

    let generation = 0;
    let listRequest = 0;
    let mineRequest = 0;
    let listController = null;
    let mineController = null;
    let disposed = false;

    const isCustomer = computed(() => state.viewer?.role === "CUSTOMER");

    // What the write area shows: guest | admin | loading | error | create | edit | view.
    const mode = computed(() => {
        if (!state.viewer) return "guest";
        if (!isCustomer.value) return "admin";
        if (state.mineError) return "error";
        if (!state.mineLoaded) return "loading";
        if (!state.mine) return "create";

        return state.editing ? "edit" : "view";
    });

    function resetViewerState() {
        mineRequest++;
        mineController?.abort();
        mineController = null;

        Object.assign(state, {
            mine: null,
            mineLoaded: false,
            mineLoading: false,
            mineError: "",
            editing: false,
            submitting: false,
            deleting: false,
            formErrors: {},
            notice: null,
        });
    }

    async function loadPage(page = 1) {
        if (disposed || state.productId == null) return;

        const request = ++listRequest;
        const { productId } = state;

        listController?.abort();
        const controller = new AbortController();
        listController = controller;

        state.listLoading = true;
        state.listError = "";

        try {
            const result = await service.list(productId, { page, limit: pageSize }, { signal: controller.signal });

            if (request !== listRequest || disposed) return;

            // Past the last page (a review was deleted meanwhile): show the last page.
            const { totalPages } = result.pagination;
            if (totalPages > 0 && page > totalPages) return await loadPage(totalPages);

            state.reviews = result.reviews;
            state.summary = result.summary;
            state.pagination = result.pagination;
        } catch {
            if (request !== listRequest || disposed) return;

            state.listError = LIST_ERROR;
        } finally {
            if (request === listRequest) {
                state.listLoading = false;
                listController = null;
            }
        }
    }

    async function loadMine() {
        if (disposed || state.productId == null) return;

        const request = ++mineRequest;
        const { productId } = state;

        mineController?.abort();
        mineController = null;
        state.mineError = "";

        // Guests and admins have no review of their own to fetch.
        if (!isCustomer.value) {
            state.mine = null;
            state.mineLoaded = false;
            state.mineLoading = false;
            return;
        }

        const controller = new AbortController();
        mineController = controller;
        state.mineLoading = true;

        try {
            const mine = await service.getMine(productId, { signal: controller.signal });

            if (request !== mineRequest || disposed) return;

            state.mine = mine ?? null;
            state.mineLoaded = true;
        } catch (error) {
            if (request !== mineRequest || disposed) return;

            const { status } = parseError(error) ?? {};
            state.mineError = status === 401 || status === 403 ? reviewErrorMessage({ status }) : MINE_ERROR;
        } finally {
            if (request === mineRequest) {
                state.mineLoading = false;
                mineController = null;
            }
        }
    }

    // A new product (or the first one): everything starts over.
    function load(productId, viewer = state.viewer) {
        if (disposed) return Promise.resolve();

        generation++;
        resetViewerState();

        Object.assign(state, {
            productId,
            viewer: viewer ?? null,
            reviews: [],
            summary: null,
            pagination: null,
            listError: "",
        });

        return Promise.all([loadPage(1), loadMine()]);
    }

    // Sign-in, sign-out or a different account on the same page.
    function setViewer(viewer) {
        const next = viewer ?? null;

        if (disposed || (next?.id === state.viewer?.id && next?.role === state.viewer?.role)) return Promise.resolve();

        generation++;
        resetViewerState();
        state.viewer = next;

        return loadMine();
    }

    // Create, or update when the customer already has a review. Returns true on success.
    async function submit(input) {
        if (disposed || state.submitting || mode.value === "loading" || !isCustomer.value) return false;

        const { valid, errors, value } = validateReview(input);

        state.formErrors = errors;
        state.notice = null;

        if (!valid) return false;

        const current = generation;
        const { productId } = state;
        const updating = Boolean(state.mine);

        state.submitting = true;

        try {
            const review = updating
                ? await service.update(productId, value)
                : await service.create(productId, value);

            if (current !== generation || disposed) return false;

            Object.assign(state, {
                mine: review,
                mineLoaded: true,
                editing: false,
                formErrors: {},
                notice: {
                    type: "success",
                    text: updating ? "Your review has been updated." : "Thanks! Your review has been posted.",
                },
            });

            // A new review is the newest, so it appears on page 1; an edit keeps its place.
            await loadPage(updating ? state.pagination?.page ?? 1 : 1);

            return true;
        } catch (error) {
            if (current !== generation || disposed) return false;

            const parsed = parseError(error) ?? {};

            state.formErrors = reviewFieldErrors(parsed);
            state.notice = { type: "error", text: reviewErrorMessage(parsed) };

            // Already reviewed (another tab, a double submit) or gone: show what is there now.
            if (parsed.status === 409 || parsed.status === 404) {
                state.editing = false;
                await Promise.all([loadMine(), loadPage(1)]);
            }

            return false;
        } finally {
            if (current === generation) state.submitting = false;
        }
    }

    async function remove() {
        if (disposed || state.deleting || !state.mine || !isCustomer.value) return false;

        const current = generation;
        const { productId } = state;

        state.deleting = true;
        state.notice = null;

        try {
            await service.remove(productId);

            if (current !== generation || disposed) return false;

            Object.assign(state, {
                mine: null,
                editing: false,
                formErrors: {},
                notice: { type: "success", text: "Your review has been deleted." },
            });

            await loadPage(state.pagination?.page ?? 1);

            return true;
        } catch (error) {
            if (current !== generation || disposed) return false;

            const parsed = parseError(error) ?? {};
            state.notice = { type: "error", text: reviewErrorMessage(parsed) };

            if (parsed.status === 404) await Promise.all([loadMine(), loadPage(1)]);

            return false;
        } finally {
            if (current === generation) state.deleting = false;
        }
    }

    function startEdit() {
        if (!state.mine) return;

        Object.assign(state, { editing: true, formErrors: {}, notice: null });
    }

    function cancelEdit() {
        Object.assign(state, { editing: false, formErrors: {} });
    }

    function clearNotice() {
        state.notice = null;
    }

    // The page was left: abort what is in flight and ignore anything that settles.
    function dispose() {
        disposed = true;
        generation++;
        listRequest++;
        mineRequest++;
        listController?.abort();
        mineController?.abort();
    }

    return {
        state: readonly(state),
        mode,
        isCustomer,
        load,
        setViewer,
        loadPage,
        loadMine,
        submit,
        remove,
        startEdit,
        cancelEdit,
        clearNotice,
        dispose,
    };
}
