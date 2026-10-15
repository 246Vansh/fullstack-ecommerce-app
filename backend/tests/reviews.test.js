// Product reviews API: public listing and rating summary, customer-only
// writes, validation, one review per customer/product (including concurrent
// submissions), ownership, verified purchase derived from DELIVERED orders,
// inactive products, the per-user write limit, and what is never exposed.
//
// Writes run only against the dedicated test database (see testDatabase.js);
// unset, the database tests are skipped, and set but unusable, the guard test
// fails and the rest are skipped. Every fixture is created by this run with
// the run id in its email, slug or order number, and after() deletes exactly
// those rows, only in ecommerce_test. Fixture orders have one item and no
// variant, so stock is never involved. Requires the add_reviews migration to
// be applied to the test database.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { signAccessToken } from "../utils/jwt.js";
import { startServer } from "./helpers.js";
import { CLEANUP_DATABASE, testDatabaseGuard, redactor } from "./testDatabase.js";

const guard = testDatabaseGuard();
const skip = guard.ok ? false : `database tests disabled: ${guard.reason}`;
const redact = redactor(guard);

// config/db.js reads DATABASE_URL when first imported, so switch it before
// importing anything that uses the database; the server gets it explicitly.
if (guard.ok) process.env.DATABASE_URL = guard.url;
const { default: prisma } = guard.ok ? await import("../config/db.js") : {};
const { authorName, REVIEW_PAGINATION } = guard.ok ? await import("../services/reviewService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);

test("the shared guard refuses the development database and accepts a dedicated one", () => {
    const dev = "mysql://app:pw@127.0.0.1:3306/ecommerce";
    const check = (TEST_DATABASE_URL) => testDatabaseGuard({ TEST_DATABASE_URL, DATABASE_URL: dev });

    assert.equal(check(undefined).missing, true);
    assert.equal(check("mysql://app:pw@127.0.0.1:3306/ecommerce_test").ok, true);
    assert.match(check("mysql://app:pw@127.0.0.1:3306/ecommerce").reason, /not a dedicated test database/);
    assert.match(check("mysql://app:pw@127.0.0.1:3306/ECOMMERCE").reason, /not a dedicated test database/);
    assert.match(check("mysql://app:pw@127.0.0.1:3306").reason, /one database/);
    assert.ok(!check("mysql://app:pw@127.0.0.1/ecommerce").reason.includes("pw"));
});

// Fails when TEST_DATABASE_URL is set but unusable, so a misconfiguration is not a silent skip.
test("TEST_DATABASE_URL names a dedicated test database", { skip: guard.missing && skip }, () => {
    assert.ok(guard.ok, guard.reason);
});

const RUN = crypto.randomBytes(4).toString("hex");
const PUBLIC_KEYS = ["author", "body", "createdAt", "id", "rating", "updatedAt", "verifiedPurchase"];
const MAX_ID = 2147483647;

let server, category, sequence = 0;
const users = {};
const products = {};
const orders = {};

// Every row this run created; cleanup deletes exactly these.
const created = { users: [], products: [], categories: [], orders: [] };

const note = (message) => console.error(`[reviews] run ${RUN}: ${message}`);

async function makeUser(label, { role = "CUSTOMER", firstName = "Fixture", lastName = label, tokenRole } = {}) {
    const email = `reviews-${RUN}-${label}@example.test`;
    const user = await prisma.user.create({ data: { email, passwordHash: "not-a-login", firstName, lastName, role } });
    created.users.push({ id: user.id, email });

    // tokenRole lets a test send a token whose role differs from the database.
    const token = signAccessToken({ id: user.id, role: tokenRole ?? role });
    return { id: user.id, email, headers: { Authorization: `Bearer ${token}` } };
}

async function makeProduct(label, { isActive = true } = {}) {
    const slug = `reviews-test-${RUN}-${label}`;
    const product = await prisma.product.create({
        data: { name: `Reviews Test ${label}`, slug, price: "25.00", categoryId: category.id, isActive },
    });
    created.products.push({ id: product.id, slug });
    return product;
}

// One order with one item for the product; no variant, so no stock.
async function makeOrder(user, productId, status) {
    sequence += 1;
    const orderNumber = `RVT-${RUN}-${sequence}`;
    const order = await prisma.order.create({
        data: {
            orderNumber, userId: user.id, status, subtotal: "25.00", total: "25.00",
            shippingFirstName: "Fixture", shippingLastName: "Customer", shippingPhone: "5550000000",
            shippingEmail: user.email, shippingAddress: "1 Fixture Way", shippingCity: "Austin",
            shippingState: "TX", shippingZipCode: "73301", shippingCountry: "United States",
            items: { create: [{ productId, productName: "Reviews Test", sku: `RVT-${RUN}`, unitPrice: "25.00", quantity: 1, lineTotal: "25.00" }] },
        },
    });
    created.orders.push({ id: order.id, orderNumber });
    return order;
}

// Deletes exactly this run's rows, all or nothing, after checking the
// connection's database. Reviews go first (only this run's products and
// users can have them); orders before users (Restrict) and products before
// the category (Restrict). Any count that differs from what was recorded
// rolls everything back.
async function cleanUpRun() {
    const tracked = Object.entries(created).map(([kind, rows]) => `${rows.length} ${kind}`).join(", ");
    note(`cleanup entered, tracking ${tracked}`);
    if (!Object.values(created).some((rows) => rows.length)) return note("cleanup had nothing to delete");

    let stage = "verify database";
    let deleted;

    const exact = async (label, rows, run) => {
        stage = `delete ${label}`;
        if (!rows.length) return 0;
        const { count } = await run();
        if (count !== rows.length) throw new Error(`deleted ${count} of ${rows.length} ${label}`);
        return count;
    };

    try {
        deleted = await prisma.$transaction(async (tx) => {
            const [{ name }] = await tx.$queryRaw`SELECT DATABASE() AS name`;
            if (name !== CLEANUP_DATABASE) throw new Error(`connected to "${name}", not "${CLEANUP_DATABASE}"`);

            const productIds = created.products.map((p) => p.id);
            const userIds = created.users.map((u) => u.id);

            stage = "delete reviews";
            const reviews = await tx.review.deleteMany({
                where: { OR: [{ productId: { in: productIds } }, { userId: { in: userIds } }] },
            });

            const result = {
                reviews: reviews.count,
                orders: await exact("orders", created.orders, () => tx.order.deleteMany({
                    where: { id: { in: created.orders.map((o) => o.id) }, orderNumber: { in: created.orders.map((o) => o.orderNumber) } },
                })),
                products: await exact("products", created.products, () => tx.product.deleteMany({
                    where: { id: { in: productIds }, slug: { in: created.products.map((p) => p.slug) } },
                })),
                categories: await exact("categories", created.categories, () => tx.category.deleteMany({
                    where: { id: { in: created.categories.map((c) => c.id) }, slug: { in: created.categories.map((c) => c.slug) } },
                })),
                users: await exact("users", created.users, () => tx.user.deleteMany({
                    where: { id: { in: userIds }, email: { in: created.users.map((u) => u.email) } },
                })),
            };

            stage = "commit";
            return result;
        });
    } catch (err) {
        const outcome = stage === "commit" ? "commit failed, outcome unknown" : `rolled back at "${stage}", nothing was deleted`;
        const reason = `${err?.name ?? "Error"}: ${redact(err?.message ?? err)}`;
        note(`cleanup ${outcome}: ${reason}`);
        throw new Error(`cleanup ${outcome} (run ${RUN}): ${reason}`);
    }

    note(`cleanup committed, deleted ${Object.entries(deleted).map(([kind, count]) => `${count} ${kind}`).join(", ")}`);
    for (const rows of Object.values(created)) rows.length = 0;
}

async function call(method, path, user, body) {
    const res = await fetch(`${server.url}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(user?.headers ?? {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
}

const reviewsPath = (product) => `/products/${product.id ?? product}/reviews`;
const minePath = (product) => `${reviewsPath(product)}/mine`;
const validBody = (label) => `A fixture review (${label}) for run ${RUN}.`;
const ownReview = (user, product) => prisma.review.findUnique({
    where: { userId_productId: { userId: user.id, productId: product.id } },
});

// 12 reviews from 12 customers, two per timestamp, so the id tie-break shows.
const PAGE_RATINGS = [5, 4, 3, 5, 2, 1, 4, 5, 3, 4, 5, 2];

before(async () => {
    if (!guard.ok) return;

    // Before any write: this process is connected to the test database.
    const [{ name }] = await prisma.$queryRaw`SELECT DATABASE() AS name`;
    assert.equal(String(name).toLowerCase(), guard.database.toLowerCase(), "test client is on the test database");
    assert.equal(name, CLEANUP_DATABASE, `tests that write run only in ${CLEANUP_DATABASE}`);
    note(`writing to ${CLEANUP_DATABASE}`);

    const categorySlug = `reviews-test-${RUN}`;
    category = await prisma.category.create({ data: { name: `Reviews Test ${RUN}`, slug: categorySlug } });
    created.categories.push({ id: category.id, slug: categorySlug });

    for (const label of ["main", "other", "paged", "empty"]) products[label] = await makeProduct(label);
    products.inactive = await makeProduct("inactive", { isActive: false });

    users.alice = await makeUser("alice", { firstName: "Alice", lastName: "zimmer" });
    users.bob = await makeUser("bob", { firstName: "Bob", lastName: "" });
    users.carol = await makeUser("carol", { firstName: "  ", lastName: "Lee" });
    users.dave = await makeUser("dave");
    users.erin = await makeUser("erin");
    users.racer = await makeUser("racer");
    users.limited = await makeUser("limited");
    users.admin = await makeUser("admin", { role: "ADMIN" });
    // Promoted to admin after signing in: the token still says CUSTOMER.
    users.promoted = await makeUser("promoted", { role: "ADMIN", tokenRole: "CUSTOMER" });

    await makeOrder(users.alice, products.main.id, "DELIVERED");
    orders.bobMain = await makeOrder(users.bob, products.main.id, "SHIPPED");
    await makeOrder(users.bob, products.other.id, "DELIVERED");
    await makeOrder(users.carol, products.main.id, "CANCELLED");

    // Alice's review of a product that has since been deactivated.
    await prisma.review.create({ data: { userId: users.alice.id, productId: products.inactive.id, rating: 4, body: validBody("inactive") } });

    for (const [n, rating] of PAGE_RATINGS.entries()) {
        const pager = await makeUser(`pager${n}`, { firstName: `Pager${n}`, lastName: `last${n}` });
        await prisma.review.create({
            data: {
                userId: pager.id, productId: products.paged.id, rating,
                body: `Pagination review ${n} for run ${RUN}`,
                createdAt: new Date(Date.UTC(2026, 0, 1, 0, Math.floor(n / 2))),
            },
        });
        // One of them bought it.
        if (n === 0) await makeOrder(pager, products.paged.id, "DELIVERED");
    }

    // DOTENV_CONFIG_OVERRIDE would make the server's dotenv replace this
    // DATABASE_URL with the one in .env; spawn drops undefined keys.
    server = await startServer({ DATABASE_URL: guard.url, DOTENV_CONFIG_OVERRIDE: undefined });

    // Before any request that writes: the server reads a review that exists
    // only in the test database (a GET, so a misrouted server changes nothing).
    const probe = await call("GET", `${reviewsPath(products.paged)}?limit=1`);
    assert.match(probe.body?.data?.[0]?.body ?? "", new RegExp(`for run ${RUN}$`), "server is on the test database");
});

// Stops the server first (no requests in flight), then cleans up, then
// disconnects. Every step runs; any failure fails the run instead of vanishing.
after(async () => {
    const errors = [];

    for (const step of [() => server?.stop(), cleanUpRun, () => prisma?.$disconnect()]) {
        try {
            await step();
        } catch (err) {
            errors.push(err);
        }
    }

    if (errors.length) process.exitCode = 1;
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, `review test teardown failed: ${errors.map((e) => redact(e?.message ?? e)).join("; ")}`);
});

dbTest("author name: first name and last initial, with fallbacks", () => {
    assert.equal(authorName("Jane", "Doe"), "Jane D.");
    assert.equal(authorName("  Jane ", " doe"), "Jane D.");
    assert.equal(authorName("Jane", ""), "Jane");
    assert.equal(authorName("Jane", null), "Jane");
    assert.equal(authorName("", "Doe"), "Customer");
    assert.equal(authorName("   ", "Doe"), "Customer");
    assert.equal(authorName("Zoë", "Øster"), "Zoë Ø.");
    assert.equal(authorName("Ann", "😀x"), "Ann 😀.");
});

dbTest("signed-out users can read reviews but not write or see their own", async () => {
    assert.equal((await call("GET", reviewsPath(products.main))).status, 200);

    for (const [method, path, body] of [
        ["GET", minePath(products.main)],
        ["POST", reviewsPath(products.main), { rating: 5, body: validBody("anon") }],
        ["PATCH", minePath(products.main), { rating: 5 }],
        ["DELETE", minePath(products.main)],
    ]) {
        assert.equal((await call(method, path, null, body)).status, 401, `${method} ${path}`);
    }
});

dbTest("admins cannot review, including an admin whose token still says customer", async () => {
    for (const [method, path, body] of [
        ["GET", minePath(products.main)],
        ["POST", reviewsPath(products.main), { rating: 5, body: validBody("admin") }],
        ["PATCH", minePath(products.main), { rating: 5 }],
        ["DELETE", minePath(products.main)],
    ]) {
        assert.equal((await call(method, path, users.admin, body)).status, 403, `${method} ${path}`);
    }

    const promoted = await call("POST", reviewsPath(products.main), users.promoted, { rating: 5, body: validBody("promoted") });
    assert.equal(promoted.status, 403);
    assert.equal(await prisma.review.count({ where: { userId: { in: [users.admin.id, users.promoted.id] } } }), 0);
});

dbTest("rating must be a whole JSON number from 1 to 5", async () => {
    for (const rating of [undefined, 0, 6, -1, 4.5, "5", true, null]) {
        const res = await call("POST", reviewsPath(products.main), users.dave, { rating, body: validBody("dave") });
        assert.equal(res.status, 422, `rating ${JSON.stringify(rating)}`);
        assert.deepEqual(res.body.details.map((d) => d.field), ["rating"]);
    }
    assert.equal(await ownReview(users.dave, products.main), null);

    assert.equal((await call("POST", reviewsPath(products.main), users.dave, { rating: 1, body: validBody("dave") })).status, 201);
    assert.equal((await call("PATCH", minePath(products.main), users.dave, { rating: 6 })).status, 422);
    assert.equal((await call("PATCH", minePath(products.main), users.dave, { rating: null })).status, 422);
    assert.equal((await ownReview(users.dave, products.main)).rating, 1);
});

dbTest("review text is required, trimmed, and 10 to 2,000 characters", async () => {
    for (const body of [undefined, 1234567890123, Array(12).fill("review text that is long enough"), "   short    ", " ".repeat(30), "x".repeat(2001), "❤️".repeat(1001)]) {
        const res = await call("POST", reviewsPath(products.main), users.erin, { rating: 4, body });
        assert.equal(res.status, 422, `body ${JSON.stringify(body)?.slice(0, 40)}`);
        assert.deepEqual(res.body.details.map((d) => d.field), ["body"]);
    }
    assert.equal(await ownReview(users.erin, products.main), null);

    const created10 = await call("POST", reviewsPath(products.main), users.erin, { rating: 4, body: "   abcdefghij \n " });
    assert.equal(created10.status, 201);
    assert.equal(created10.body.data.body, "abcdefghij");
    assert.equal((await ownReview(users.erin, products.main)).body, "abcdefghij");

    assert.equal((await call("PATCH", minePath(products.main), users.erin, { body: "x".repeat(2000) })).status, 200);

    // 1,000 emoji with a variation selector are 2,000 code points, which is
    // how MySQL counts VARCHAR(2000): accepted and stored whole.
    const emoji = "❤️".repeat(1000);
    assert.equal((await call("PATCH", minePath(products.main), users.erin, { body: emoji })).status, 200);
    assert.equal((await ownReview(users.erin, products.main)).body, emoji);

    // An update must change something; unknown fields do not count.
    assert.equal((await call("PATCH", minePath(products.main), users.erin, {})).status, 422);
    assert.equal((await call("PATCH", minePath(products.main), users.erin, { title: "A title" })).status, 422);
});

dbTest("client-supplied ids, author and verification are ignored; nothing private is returned", async () => {
    const res = await call("POST", reviewsPath(products.main), users.alice, {
        rating: 5, body: validBody("alice"),
        verifiedPurchase: false, userId: users.bob.id, productId: products.other.id, id: 1,
        author: "Someone Else", createdAt: "2000-01-01T00:00:00.000Z", email: "x@example.test",
    });

    assert.equal(res.status, 201);
    assert.deepEqual(Object.keys(res.body.data).sort(), PUBLIC_KEYS);
    assert.equal(res.body.data.author, "Alice Z.");
    assert.equal(res.body.data.verifiedPurchase, true, "derived from Alice's DELIVERED order");

    const row = await ownReview(users.alice, products.main);
    assert.equal(row.id, res.body.data.id);
    assert.equal(row.productId, products.main.id);
    assert.ok(row.createdAt.getFullYear() > 2000);
    assert.equal(await ownReview(users.bob, products.other), null);

    // Carol has only a CANCELLED order: claiming verification changes nothing.
    const carol = await call("POST", reviewsPath(products.main), users.carol, { rating: 3, body: validBody("carol"), verifiedPurchase: true });
    assert.equal(carol.status, 201);
    assert.equal(carol.body.data.verifiedPurchase, false);
    assert.equal(carol.body.data.author, "Customer");

    const listed = await call("GET", `${reviewsPath(products.main)}?limit=50`);
    const text = JSON.stringify(listed.body);
    for (const review of listed.body.data) assert.deepEqual(Object.keys(review).sort(), PUBLIC_KEYS);
    for (const user of Object.values(users)) assert.ok(!text.includes(user.email), "no emails");
    for (const key of ["userId", "email", "order", "productId"]) assert.ok(!text.includes(`"${key}`), `no ${key}`);
});

dbTest("verified purchase follows the buyer's DELIVERED order for this product, at read time", async () => {
    // Bob's order for this product is SHIPPED; his DELIVERED order is for another product.
    const res = await call("POST", reviewsPath(products.main), users.bob, { rating: 4, body: validBody("bob") });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.verifiedPurchase, false);
    assert.equal(res.body.data.author, "Bob");

    const bobInList = async () => (await call("GET", `${reviewsPath(products.main)}?limit=50`)).body.data.find((r) => r.id === res.body.data.id);

    await prisma.order.update({ where: { id: orders.bobMain.id }, data: { status: "DELIVERED" } });
    assert.equal((await call("GET", minePath(products.main), users.bob)).body.data.verifiedPurchase, true);
    assert.equal((await bobInList()).verifiedPurchase, true);

    await prisma.order.update({ where: { id: orders.bobMain.id }, data: { status: "REFUNDED" } });
    assert.equal((await call("GET", minePath(products.main), users.bob)).body.data.verifiedPurchase, false);
    assert.equal((await bobInList()).verifiedPurchase, false);
});

dbTest("one review per customer and product, also for simultaneous submissions", async () => {
    const again = await call("POST", reviewsPath(products.main), users.alice, { rating: 1, body: validBody("alice again") });
    assert.equal(again.status, 409);
    assert.equal((await ownReview(users.alice, products.main)).rating, 5);

    const results = await Promise.all([1, 2].map((n) =>
        call("POST", reviewsPath(products.main), users.racer, { rating: n, body: validBody(`racer ${n}`) })));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await prisma.review.count({ where: { userId: users.racer.id, productId: products.main.id } }), 1);
});

dbTest("customers can only read, change or delete their own review", async () => {
    const carol = await call("POST", reviewsPath(products.other), users.carol, { rating: 5, body: validBody("carol other") });
    assert.equal(carol.status, 201);

    // Bob has no review of this product, so "mine" is nothing for him.
    assert.deepEqual((await call("GET", minePath(products.other), users.bob)).body, { success: true, data: null });
    assert.equal((await call("PATCH", minePath(products.other), users.bob, { rating: 1 })).status, 404);
    assert.equal((await call("DELETE", minePath(products.other), users.bob)).status, 404);

    // Reviews are never addressed by id.
    assert.equal((await call("PATCH", `${reviewsPath(products.other)}/${carol.body.data.id}`, users.bob, { rating: 1 })).status, 404);
    assert.equal((await call("DELETE", `${reviewsPath(products.other)}/${carol.body.data.id}`, users.bob)).status, 404);

    const row = await ownReview(users.carol, products.other);
    assert.equal(row.rating, 5);
    assert.equal(row.body, validBody("carol other"));
});

dbTest("a customer edits and deletes their review, then may review again", async () => {
    const original = await ownReview(users.carol, products.other);

    const rated = await call("PATCH", minePath(products.other), users.carol, { rating: 2 });
    assert.equal(rated.status, 200);
    assert.equal(rated.body.data.rating, 2);
    assert.equal(rated.body.data.body, original.body, "unchanged fields stay");
    assert.equal(rated.body.data.id, original.id);

    const rewritten = await call("PATCH", minePath(products.other), users.carol, { body: `  ${validBody("carol edited")}  ` });
    assert.equal(rewritten.body.data.body, validBody("carol edited"));
    assert.equal(rewritten.body.data.rating, 2);

    assert.deepEqual((await call("DELETE", minePath(products.other), users.carol)).body, { success: true, message: "Review deleted" });
    assert.equal(await ownReview(users.carol, products.other), null);
    assert.deepEqual((await call("GET", minePath(products.other), users.carol)).body.data, null);
    assert.equal((await call("DELETE", minePath(products.other), users.carol)).status, 404);
    assert.equal((await call("PATCH", minePath(products.other), users.carol, { rating: 3 })).status, 404);

    assert.equal((await call("POST", reviewsPath(products.other), users.carol, { rating: 3, body: validBody("carol again") })).status, 201);
});

dbTest("listing: newest first with id tie-break, accurate summary, stable pages", async () => {
    const expected = (await prisma.review.findMany({
        where: { productId: products.paged.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
    })).map((r) => r.id);
    assert.equal(expected.length, PAGE_RATINGS.length);

    const first = await call("GET", reviewsPath(products.paged));
    assert.equal(first.status, 200);
    assert.deepEqual(Object.keys(first.body).sort(), ["data", "pagination", "success", "summary"]);
    assert.deepEqual(first.body.summary, {
        averageRating: Math.round((PAGE_RATINGS.reduce((a, b) => a + b, 0) / PAGE_RATINGS.length) * 10) / 10,
        reviewCount: PAGE_RATINGS.length,
    });
    assert.deepEqual(first.body.pagination, {
        page: 1, limit: REVIEW_PAGINATION.defaultLimit, total: PAGE_RATINGS.length,
        totalPages: Math.ceil(PAGE_RATINGS.length / REVIEW_PAGINATION.defaultLimit),
    });

    const seen = [];
    for (let page = 1; page <= Math.ceil(expected.length / 5); page++) {
        const { body } = await call("GET", `${reviewsPath(products.paged)}?page=${page}&limit=5`);
        assert.equal(body.pagination.totalPages, 3);
        seen.push(...body.data);
    }
    assert.deepEqual(seen.map((r) => r.id), expected);
    assert.equal(seen.filter((r) => r.verifiedPurchase).length, 1);
    assert.ok(seen.every((r) => /^Pager\d+ L\.$/.test(r.author)));

    const past = await call("GET", `${reviewsPath(products.paged)}?page=4&limit=5`);
    assert.equal(past.status, 200);
    assert.deepEqual(past.body.data, []);
    assert.equal(past.body.pagination.total, PAGE_RATINGS.length);

    const empty = await call("GET", reviewsPath(products.empty));
    assert.deepEqual(empty.body.data, []);
    assert.deepEqual(empty.body.summary, { averageRating: null, reviewCount: 0 });
    assert.equal(empty.body.pagination.totalPages, 0);

    for (const query of [`?limit=${REVIEW_PAGINATION.maxLimit + 1}`, "?limit=0", "?page=0", "?page=1&page=2", "?limit=abc"]) {
        assert.equal((await call("GET", `${reviewsPath(products.paged)}${query}`)).status, 422, query);
    }
});

dbTest("inactive and missing products behave as not found; their reviews are kept", async () => {
    for (const [method, path, body] of [
        ["GET", reviewsPath(products.inactive)],
        ["GET", minePath(products.inactive)],
        ["POST", reviewsPath(products.inactive), { rating: 5, body: validBody("inactive post") }],
        ["PATCH", minePath(products.inactive), { rating: 1 }],
        ["DELETE", minePath(products.inactive)],
        ["GET", reviewsPath(MAX_ID)],
        ["POST", reviewsPath(MAX_ID), { rating: 5, body: validBody("missing") }],
    ]) {
        const res = await call(method, path, users.alice, body);
        assert.equal(res.status, 404, `${method} ${path}`);
        assert.equal(res.body.message, "Product not found");
    }

    const kept = await ownReview(users.alice, products.inactive);
    assert.equal(kept.rating, 4);

    for (const id of ["abc", "0", "-1", String(MAX_ID + 1)]) {
        assert.equal((await call("GET", reviewsPath(id))).status, 422, id);
    }
});

dbTest("review writes are limited per user; reads and other users are not affected", async () => {
    for (let i = 0; i < 20; i++) {
        assert.equal((await call("POST", reviewsPath(products.main), users.limited, {})).status, 422, `request ${i + 1}`);
    }

    const blocked = await call("POST", reviewsPath(products.main), users.limited, { rating: 5, body: validBody("limited") });
    assert.equal(blocked.status, 429);
    assert.equal(await ownReview(users.limited, products.main), null);

    assert.equal((await call("GET", minePath(products.main), users.limited)).status, 200);
    assert.equal((await call("GET", reviewsPath(products.main))).status, 200);
    assert.equal((await call("POST", reviewsPath(products.other), users.dave, {})).status, 422, "another user's budget");
});

dbTest("product detail and batch responses are unchanged (no review data)", async () => {
    const detail = await call("GET", `/products/${products.paged.id}`);
    const batch = await call("GET", `/products/batch?ids=${products.paged.id},${products.main.id}`);

    assert.equal(detail.status, 200);
    assert.equal(batch.status, 200);
    for (const product of [detail.body.data, ...batch.body.data]) {
        for (const key of ["reviews", "rating", "averageRating", "reviewCount"]) assert.ok(!(key in product), key);
    }
});

dbTest("deleting a user or a product deletes their reviews", async () => {
    const user = await makeUser("cascade-user");
    const product = await makeProduct("cascade-product");

    await prisma.review.create({ data: { userId: user.id, productId: products.empty.id, rating: 3, body: validBody("cascade user") } });
    await prisma.review.create({ data: { userId: users.dave.id, productId: product.id, rating: 3, body: validBody("cascade product") } });

    await prisma.user.delete({ where: { id: user.id } });
    created.users.splice(created.users.findIndex((u) => u.id === user.id), 1);
    assert.equal(await prisma.review.count({ where: { userId: user.id } }), 0);

    await prisma.product.delete({ where: { id: product.id } });
    created.products.splice(created.products.findIndex((p) => p.id === product.id), 1);
    assert.equal(await prisma.review.count({ where: { productId: product.id } }), 0);
});
