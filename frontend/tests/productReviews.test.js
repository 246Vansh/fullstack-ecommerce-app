// Product review state (src/composables/useProductReviews.js) against a fake
// review service: loading, pagination, stale responses, who may call /mine,
// and the customer's create / edit / delete flows.
// Run with: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { useProductReviews } from "../src/composables/useProductReviews.js";
import { REVIEW_PAGE_SIZE } from "../src/utils/reviews.js";

const GUEST = null;
const CUSTOMER = { id: 7, role: "CUSTOMER" };
const ADMIN = { id: 1, role: "ADMIN" };

// What parseApiError returns; the composable is given an identity parser.
const apiError = (status, message = "", fields = {}) => ({ status, message, fields });

const review = (id, overrides = {}) => ({
    id, rating: 4, body: `Review number ${id} text`, author: `Author ${id}`, verifiedPurchase: false,
    createdAt: `2026-01-${String((id % 28) + 1).padStart(2, "0")}T00:00:00.000Z`, updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
});

// An in-memory stand-in for the reviews API of one product, newest first.
function fakeApi({ count = 0, mine = null } = {}) {
    const calls = [];
    const db = { reviews: Array.from({ length: count }, (_, i) => review(count - i)), mine, nextId: 1000 };

    const summary = () => ({
        averageRating: db.reviews.length ? Math.round((db.reviews.reduce((sum, r) => sum + r.rating, 0) / db.reviews.length) * 10) / 10 : null,
        reviewCount: db.reviews.length,
    });

    const service = {
        async list(productId, { page, limit }, { signal } = {}) {
            calls.push({ op: "list", productId, page, limit, signal });
            const total = db.reviews.length;
            return {
                reviews: db.reviews.slice((page - 1) * limit, page * limit),
                summary: summary(),
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            };
        },
        async getMine(productId) {
            calls.push({ op: "mine", productId });
            return db.mine;
        },
        async create(productId, value) {
            calls.push({ op: "create", productId, value });
            if (db.mine) throw apiError(409, "You have already reviewed this product");
            db.mine = { ...review(db.nextId++), ...value, author: "Jane D." };
            db.reviews.unshift(db.mine);
            return db.mine;
        },
        async update(productId, value) {
            calls.push({ op: "update", productId, value });
            if (!db.mine) throw apiError(404, "Review not found");
            Object.assign(db.mine, value);
            return { ...db.mine };
        },
        async remove(productId) {
            calls.push({ op: "remove", productId });
            if (!db.mine) throw apiError(404, "Review not found");
            db.reviews = db.reviews.filter((r) => r.id !== db.mine.id);
            db.mine = null;
        },
    };

    return { service, calls, db, ops: () => calls.map((c) => c.op) };
}

function deferred() {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}

const listResult = (productId, page, reviews, total = reviews.length) => ({
    reviews, summary: { averageRating: 4, reviewCount: total }, pagination: { page, limit: REVIEW_PAGE_SIZE, total, totalPages: Math.ceil(total / REVIEW_PAGE_SIZE) },
});

const valid = { rating: 5, body: "  Lovely shirt, fits well.  " };

test("guests load the first page and summary, and never call /mine", async () => {
    const api = fakeApi({ count: 3 });
    const reviews = useProductReviews({ service: api.service });

    await reviews.load(5, GUEST);

    assert.deepEqual(api.ops(), ["list"]);
    assert.deepEqual({ productId: api.calls[0].productId, page: api.calls[0].page, limit: api.calls[0].limit }, { productId: 5, page: 1, limit: REVIEW_PAGE_SIZE });
    assert.equal(reviews.mode.value, "guest");
    assert.equal(reviews.state.reviews.length, 3);
    assert.deepEqual(reviews.state.summary, { averageRating: 4, reviewCount: 3 });
    assert.equal(reviews.state.listLoading, false);

    assert.equal(await reviews.submit(valid), false);
    assert.equal(await reviews.remove(), false);
    assert.deepEqual(api.ops(), ["list"], "a guest's submit sends nothing");
});

test("admins see reviews but never call /mine and cannot submit", async () => {
    const api = fakeApi({ count: 1 });
    const reviews = useProductReviews({ service: api.service });

    await reviews.load(5, ADMIN);

    assert.equal(reviews.mode.value, "admin");
    assert.equal(await reviews.submit(valid), false);
    assert.deepEqual(api.ops(), ["list"]);
});

test("customers load their own review: none -> create, existing -> view, edit and cancel", async () => {
    const none = fakeApi();
    const first = useProductReviews({ service: none.service });
    await first.load(5, CUSTOMER);
    assert.deepEqual(none.ops().sort(), ["list", "mine"]);
    assert.equal(first.mode.value, "create");

    const own = review(42, { rating: 3 });
    const existing = fakeApi({ mine: own });
    const second = useProductReviews({ service: existing.service });
    await second.load(5, CUSTOMER);
    assert.equal(second.mode.value, "view");
    assert.equal(second.state.mine.id, 42);

    second.startEdit();
    assert.equal(second.mode.value, "edit");
    second.cancelEdit();
    assert.equal(second.mode.value, "view");
});

test("while /mine is loading the customer cannot submit (a create could clash with an edit)", async () => {
    const api = fakeApi();
    const pending = deferred();
    api.service.getMine = () => pending.promise;
    const reviews = useProductReviews({ service: api.service });

    const loading = reviews.load(5, CUSTOMER);
    assert.equal(reviews.mode.value, "loading");
    assert.equal(await reviews.submit(valid), false);

    pending.resolve(null);
    await loading;
    assert.equal(reviews.mode.value, "create");
    assert.ok(!api.ops().includes("create"));
});

test("pagination requests the chosen page and keeps the API's page data", async () => {
    const api = fakeApi({ count: 23 });
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, GUEST);

    await reviews.loadPage(3);

    assert.equal(api.calls.at(-1).page, 3);
    assert.deepEqual(reviews.state.pagination, { page: 3, limit: REVIEW_PAGE_SIZE, total: 23, totalPages: 3 });
    assert.deepEqual(reviews.state.reviews.map((r) => r.id), [3, 2, 1]);
    assert.equal(reviews.state.summary.reviewCount, 23);
});

test("a page past the end (reviews removed meanwhile) shows the last page instead", async () => {
    const api = fakeApi({ count: 15 });
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, GUEST);

    await reviews.loadPage(3);

    assert.deepEqual(api.calls.filter((c) => c.op === "list").map((c) => c.page), [1, 3, 2]);
    assert.equal(reviews.state.pagination.page, 2);
    assert.equal(reviews.state.reviews.length, 5);
});

test("only the latest page request writes state; the earlier one is aborted", async () => {
    const api = fakeApi();
    const pages = {};
    api.service.list = (productId, { page }, { signal }) => {
        pages[page] = { ...deferred(), signal };
        return pages[page].promise;
    };
    const reviews = useProductReviews({ service: api.service });

    const initial = reviews.load(5, GUEST);
    pages[1].resolve(listResult(5, 1, [review(1)], 30));
    await initial;

    const two = reviews.loadPage(2);
    const three = reviews.loadPage(3);
    assert.equal(pages[2].signal.aborted, true);
    assert.equal(pages[3].signal.aborted, false);

    pages[3].resolve(listResult(5, 3, [review(3)], 30));
    await three;
    pages[2].resolve(listResult(5, 2, [review(2)], 30));
    await two;

    assert.equal(reviews.state.pagination.page, 3);
    assert.deepEqual(reviews.state.reviews.map((r) => r.id), [3]);
    assert.equal(reviews.state.listLoading, false);
});

test("a new product replaces the old one; late responses for the old product are ignored", async () => {
    const api = fakeApi();
    const pending = {};
    api.service.list = (productId) => {
        pending[productId] = deferred();
        return pending[productId].promise;
    };
    api.service.getMine = async (productId) => (productId === 1 ? review(11) : null);
    const reviews = useProductReviews({ service: api.service });

    const old = reviews.load(1, CUSTOMER);
    const next = reviews.load(2, CUSTOMER);

    pending[2].resolve(listResult(2, 1, [review(22)]));
    await next;
    pending[1].resolve(listResult(1, 1, [review(11), review(12)]));
    await old;

    assert.equal(reviews.state.productId, 2);
    assert.deepEqual(reviews.state.reviews.map((r) => r.id), [22]);
    assert.equal(reviews.state.mine, null);
    assert.equal(reviews.mode.value, "create");
});

test("after dispose nothing settles into state", async () => {
    const api = fakeApi();
    const pending = deferred();
    let listCalls = 0;
    api.service.list = () => {
        listCalls++;
        return pending.promise;
    };
    const reviews = useProductReviews({ service: api.service });

    const loading = reviews.load(5, GUEST);
    reviews.dispose();
    pending.resolve(listResult(5, 1, [review(1)]));
    await loading;

    assert.deepEqual(reviews.state.reviews, []);
    assert.equal(reviews.state.summary, null);

    await reviews.loadPage(2);
    await reviews.load(6, CUSTOMER);
    assert.equal(listCalls, 1, "no request after dispose");
});

test("invalid input is reported and never sent", async () => {
    const api = fakeApi();
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, CUSTOMER);

    assert.equal(await reviews.submit({ rating: 0, body: "short" }), false);
    assert.deepEqual(reviews.state.formErrors, {
        rating: "Choose a rating from 1 to 5 stars",
        body: "Your review must be at least 10 characters",
    });
    assert.ok(!api.ops().includes("create"));
});

test("creating a review sends the trimmed text, shows it, and refreshes page 1 and the summary", async () => {
    const api = fakeApi({ count: 12 });
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, CUSTOMER);
    await reviews.loadPage(2);

    assert.equal(await reviews.submit({ ...valid, verifiedPurchase: true, author: "Someone" }), true);

    assert.deepEqual(api.calls.find((c) => c.op === "create").value, { rating: 5, body: "Lovely shirt, fits well." });
    assert.equal(reviews.mode.value, "view");
    assert.equal(reviews.state.mine.body, "Lovely shirt, fits well.");
    assert.deepEqual(reviews.state.notice, { type: "success", text: "Thanks! Your review has been posted." });
    assert.equal(reviews.state.pagination.page, 1);
    assert.equal(reviews.state.reviews[0].id, reviews.state.mine.id);
    assert.equal(reviews.state.summary.reviewCount, 13);
    assert.equal(reviews.state.submitting, false);
    assert.deepEqual(reviews.state.formErrors, {});
});

test("a duplicate (409) shows the existing review instead of the form", async () => {
    const api = fakeApi();
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, CUSTOMER);

    // Reviewed meanwhile in another tab.
    api.db.mine = review(77, { rating: 2 });
    api.db.reviews.unshift(api.db.mine);

    assert.equal(await reviews.submit(valid), false);

    assert.equal(reviews.state.notice.type, "error");
    assert.match(reviews.state.notice.text, /already reviewed this product/);
    assert.equal(reviews.mode.value, "view");
    assert.equal(reviews.state.mine.id, 77);
    assert.equal(reviews.state.summary.reviewCount, 1);
});

test("server validation errors (422) appear on the fields", async () => {
    const api = fakeApi();
    api.service.create = async () => { throw apiError(422, "Validation failed", { body: "Review text must be 10 to 2000 characters" }); };
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, CUSTOMER);

    assert.equal(await reviews.submit(valid), false);

    assert.deepEqual(reviews.state.formErrors, { body: "Review text must be 10 to 2000 characters" });
    assert.deepEqual(reviews.state.notice, { type: "error", text: "Please fix the highlighted fields." });
    assert.equal(reviews.mode.value, "create", "the form stays, with the customer's text");
});

test("rate limits and sign-in problems are explained", async () => {
    for (const [status, pattern] of [[429, /^Too many review changes, please try again later$/], [401, /sign in again/], [403, /Only customer accounts/], [500, /Something went wrong/]]) {
        const api = fakeApi();
        api.service.create = async () => { throw apiError(status, status === 429 ? "Too many review changes, please try again later" : "x"); };
        const reviews = useProductReviews({ service: api.service });
        await reviews.load(5, CUSTOMER);

        assert.equal(await reviews.submit(valid), false);
        assert.match(reviews.state.notice.text, pattern, String(status));
        assert.equal(reviews.state.submitting, false);
    }
});

test("editing updates the existing review in place (never creates)", async () => {
    const api = fakeApi({ count: 15 });
    api.db.mine = api.db.reviews[12];
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, CUSTOMER);
    await reviews.loadPage(2);

    reviews.startEdit();
    assert.equal(await reviews.submit({ rating: 2, body: "Changed my mind about it." }), true);

    assert.deepEqual(api.ops().filter((op) => ["create", "update"].includes(op)), ["update"]);
    assert.equal(reviews.mode.value, "view");
    assert.equal(reviews.state.mine.rating, 2);
    assert.deepEqual(reviews.state.notice, { type: "success", text: "Your review has been updated." });
    assert.equal(reviews.state.pagination.page, 2, "an edit keeps the current page");
});

test("deleting removes the review, returns to the form and refreshes the list", async () => {
    const api = fakeApi({ count: 3 });
    api.db.mine = api.db.reviews[0];
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, CUSTOMER);

    assert.equal(await reviews.remove(), true);

    assert.equal(reviews.state.mine, null);
    assert.equal(reviews.mode.value, "create");
    assert.deepEqual(reviews.state.notice, { type: "success", text: "Your review has been deleted." });
    assert.equal(reviews.state.summary.reviewCount, 2);
    assert.equal(await reviews.remove(), false, "nothing left to delete");
});

test("deleting a review that is already gone (404) refreshes instead of failing silently", async () => {
    const api = fakeApi({ count: 2 });
    api.db.mine = api.db.reviews[0];
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, CUSTOMER);

    // Deleted in another tab.
    api.db.reviews.shift();
    api.db.mine = null;

    assert.equal(await reviews.remove(), false);
    assert.match(reviews.state.notice.text, /no longer available/);
    assert.equal(reviews.mode.value, "create");
    assert.equal(reviews.state.summary.reviewCount, 1);
});

test("signing in, switching to an admin and signing out update what is loaded", async () => {
    const api = fakeApi({ mine: review(5) });
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, GUEST);
    assert.deepEqual(api.ops(), ["list"]);

    await reviews.setViewer(CUSTOMER);
    assert.deepEqual(api.ops(), ["list", "mine"]);
    assert.equal(reviews.mode.value, "view");

    await reviews.setViewer({ ...CUSTOMER });
    assert.equal(api.ops().length, 2, "the same viewer does not reload");

    await reviews.setViewer(ADMIN);
    assert.equal(reviews.mode.value, "admin");
    assert.equal(reviews.state.mine, null);
    assert.equal(api.ops().length, 2, "admins never call /mine");

    await reviews.setViewer(GUEST);
    assert.equal(reviews.mode.value, "guest");
    assert.equal(api.ops().length, 2);
});

test("a save still in flight when the viewer changes is ignored", async () => {
    const api = fakeApi();
    const pending = deferred();
    api.service.create = () => pending.promise;
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, CUSTOMER);

    const saving = reviews.submit(valid);
    assert.equal(reviews.state.submitting, true);

    await reviews.setViewer(GUEST);
    pending.resolve(review(9));

    assert.equal(await saving, false);
    assert.equal(reviews.state.mine, null);
    assert.equal(reviews.state.notice, null);
    assert.equal(reviews.state.submitting, false);
    assert.equal(reviews.mode.value, "guest");
});

test("a failed /mine request can be retried", async () => {
    const api = fakeApi();
    let fail = true;
    api.service.getMine = async () => {
        if (fail) throw apiError(500, "Internal server error");
        return null;
    };
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, CUSTOMER);

    assert.equal(reviews.mode.value, "error");
    assert.equal(reviews.state.mineError, "We couldn't load your review. Please try again.");

    fail = false;
    await reviews.loadMine();
    assert.equal(reviews.mode.value, "create");
});

test("a failed list request reports an error and can be retried", async () => {
    const api = fakeApi({ count: 2 });
    const list = api.service.list;
    api.service.list = async () => { throw apiError(500); };
    const reviews = useProductReviews({ service: api.service });
    await reviews.load(5, GUEST);

    assert.equal(reviews.state.listError, "We couldn't load reviews. Please try again.");

    api.service.list = list;
    await reviews.loadPage(1);
    assert.equal(reviews.state.listError, "");
    assert.equal(reviews.state.reviews.length, 2);
});
