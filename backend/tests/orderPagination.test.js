// Order history pagination: page boundaries, empty results, stable ordering,
// parameter validation and customer isolation.
// Orders are never deleted, so the data is two fixed fixture customers whose
// orders are created once and reused on every run (upserted by order number).
// They are CANCELLED and have no items: no stock, cart or real customer is touched.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import prisma from "../config/db.js";
import { signAccessToken } from "../utils/jwt.js";
import { ORDER_PAGINATION } from "../services/orderService.js";
import { startServer } from "./helpers.js";

// Orders per fixture customer. Every 3 consecutive orders share one createdAt,
// so the id tie-break is exercised on every page.
const FIXTURES = { a: 23, b: 3 };

let server;
const users = {};

async function ensureFixture(label, count) {
    const user = await prisma.user.upsert({
        where: { email: `pagination-fixture-${label}@example.test` },
        update: {},
        create: { email: `pagination-fixture-${label}@example.test`, passwordHash: "not-a-login", firstName: "Pagination", lastName: `Fixture ${label}`, role: "CUSTOMER" },
    });

    for (let n = 0; n < count; n++) {
        await prisma.order.upsert({
            where: { orderNumber: `PAGFIX-${label}-${String(n).padStart(3, "0")}` },
            update: {},
            create: {
                orderNumber: `PAGFIX-${label}-${String(n).padStart(3, "0")}`,
                userId: user.id,
                status: "CANCELLED",
                subtotal: "10.00",
                total: "10.00",
                createdAt: new Date(Date.UTC(2020, 0, 1, 0, Math.floor(n / 3))),
                shippingFirstName: "Pagination", shippingLastName: "Fixture", shippingPhone: "5550000000",
                shippingEmail: user.email, shippingAddress: "1 Fixture Way", shippingCity: "Austin",
                shippingState: "TX", shippingZipCode: "73301", shippingCountry: "United States",
            },
        });
    }

    return { id: user.id, headers: { Authorization: `Bearer ${signAccessToken(user)}` } };
}

async function list(user, query = "") {
    const res = await fetch(`${server.url}/orders${query}`, { headers: user?.headers ?? {} });
    return { status: res.status, body: await res.json() };
}

// The expected order, straight from the database.
const expectedIds = (userId) => prisma.order.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
}).then((rows) => rows.map((row) => row.id));

before(async () => {
    server = await startServer();
    users.a = await ensureFixture("a", FIXTURES.a);
    users.b = await ensureFixture("b", FIXTURES.b);
});

after(async () => {
    // Fixture customers and their orders are kept for the next run.
    await server.stop();
    await prisma.$disconnect();
});

test("default page: first page of the default size, with accurate totals", async () => {
    const total = await prisma.order.count({ where: { userId: users.a.id } });
    const { status, body } = await list(users.a);

    assert.equal(status, 200);
    assert.equal(body.data.length, Math.min(total, ORDER_PAGINATION.defaultLimit));
    assert.deepEqual(body.pagination, {
        page: 1,
        limit: ORDER_PAGINATION.defaultLimit,
        total,
        totalPages: Math.ceil(total / ORDER_PAGINATION.defaultLimit),
    });
    assert.deepEqual(Object.keys(body.data[0]).sort(), ["createdAt", "id", "itemCount", "orderNumber", "status", "total"]);
});

test("walking every page gives each order exactly once, newest first, ties by id", async () => {
    const expected = await expectedIds(users.a.id);
    const limit = 5;
    const seen = [];

    for (let page = 1; page <= Math.ceil(expected.length / limit); page++) {
        const { body } = await list(users.a, `?page=${page}&limit=${limit}`);
        assert.equal(body.pagination.page, page);
        assert.equal(body.pagination.totalPages, Math.ceil(expected.length / limit));
        seen.push(...body.data);
    }

    assert.deepEqual(seen.map((o) => o.id), expected);
    assert.equal(new Set(seen.map((o) => o.id)).size, expected.length);

    // Same instant -> higher id first, so the order never depends on the database's whim.
    for (let i = 1; i < seen.length; i++) {
        const prev = Date.parse(seen[i - 1].createdAt);
        const curr = Date.parse(seen[i].createdAt);
        assert.ok(prev > curr || (prev === curr && seen[i - 1].id > seen[i].id), `rows ${i - 1}/${i} out of order`);
    }

    // Repeating a page returns the same rows.
    const again = await list(users.a, `?page=2&limit=${limit}`);
    assert.deepEqual(again.body.data.map((o) => o.id), expected.slice(limit, 2 * limit));
});

test("page boundaries: exact last page, partial last page, past the end, max limit", async () => {
    const expected = await expectedIds(users.a.id);
    const total = expected.length;

    const last = await list(users.a, `?page=${Math.ceil(total / 10)}&limit=10`);
    assert.deepEqual(last.body.data.map((o) => o.id), expected.slice(10 * (Math.ceil(total / 10) - 1)));

    const exact = await list(users.a, `?page=1&limit=${total}`);
    assert.equal(exact.body.data.length, total);
    assert.equal(exact.body.pagination.totalPages, 1);

    const past = await list(users.a, `?page=${Math.ceil(total / 10) + 1}&limit=10`);
    assert.equal(past.status, 200);
    assert.deepEqual(past.body.data, []);
    assert.equal(past.body.pagination.total, total);
    assert.equal(past.body.pagination.totalPages, Math.ceil(total / 10));

    const max = await list(users.a, `?limit=${ORDER_PAGINATION.maxLimit}`);
    assert.equal(max.status, 200);
    assert.equal(max.body.data.length, Math.min(total, ORDER_PAGINATION.maxLimit));

    const maxPage = await list(users.a, `?page=${ORDER_PAGINATION.maxPage}`);
    assert.equal(maxPage.status, 200);
    assert.deepEqual(maxPage.body.data, []);
});

test("a customer with no orders gets an empty first page", async () => {
    const user = await prisma.user.upsert({
        where: { email: "pagination-fixture-empty@example.test" },
        update: {},
        create: { email: "pagination-fixture-empty@example.test", passwordHash: "not-a-login", firstName: "Pagination", lastName: "Empty", role: "CUSTOMER" },
    });
    const { status, body } = await list({ headers: { Authorization: `Bearer ${signAccessToken(user)}` } });

    assert.equal(status, 200);
    assert.deepEqual(body.data, []);
    assert.deepEqual(body.pagination, { page: 1, limit: ORDER_PAGINATION.defaultLimit, total: 0, totalPages: 0 });
});

test("invalid page/limit values are rejected with 422 and a field message", async () => {
    const invalid = {
        page: ["0", "-1", "1.5", "abc", "1e3", String(ORDER_PAGINATION.maxPage + 1), "99999999999999999999"],
        limit: ["0", "-5", "abc", String(ORDER_PAGINATION.maxLimit + 1)],
    };

    for (const [field, values] of Object.entries(invalid)) {
        for (const value of values) {
            const { status, body } = await list(users.a, `?${field}=${encodeURIComponent(value)}`);
            assert.equal(status, 422, `${field}=${value}`);
            assert.equal(body.details[0].field, field, `${field}=${value}`);
        }
    }

    // Repeated parameters are ambiguous, not silently resolved.
    for (const query of ["?page=1&page=2", "?limit=5&limit=6"]) {
        assert.equal((await list(users.a, query)).status, 422, query);
    }

    // An empty value means "not given".
    const blank = await list(users.a, "?page=&limit=");
    assert.equal(blank.status, 200);
    assert.equal(blank.body.pagination.page, 1);
    assert.equal(blank.body.pagination.limit, ORDER_PAGINATION.defaultLimit);
});

test("pagination never crosses customers", async () => {
    const aIds = new Set(await expectedIds(users.a.id));
    const bIds = await expectedIds(users.b.id);

    // B walks every page (and beyond), even with a userId in the query.
    const seen = [];
    for (const query of ["?limit=1&page=1", "?limit=1&page=2", "?limit=1&page=3", "?limit=1&page=4",
        `?limit=50&userId=${users.a.id}`, `?page=2&limit=10&userId=${users.a.id}`]) {
        const { status, body } = await list(users.b, query);
        assert.equal(status, 200, query);
        assert.equal(body.pagination.total, bIds.length, query);
        seen.push(...body.data.map((o) => o.id));
    }

    assert.ok(seen.every((id) => !aIds.has(id)), "B never sees A's orders");
    assert.deepEqual([...new Set(seen)].sort(), [...bIds].sort());

    assert.equal((await list(null, "?page=1")).status, 401);
});
