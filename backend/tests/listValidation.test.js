// Query validation for the public and admin product lists: repeated
// parameters, unsafe integers and invalid page/limit values are 422 (they
// used to be 500s), while valid values and boundaries behave as before.
// Creates a throwaway admin and customer (no orders) and a catalog of its own
// (one category; two active products and one inactive, plus enough variant-less
// fillers that both lists hold more rows than their largest page), all removed
// in after(), so the boundary checks always have rows to compare.
//
// Writes only to the test database named by TEST_DATABASE_URL (see
// testDatabase.js); unset, these tests are skipped and nothing connects.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { signAccessToken } from "../utils/jwt.js";
import { startServer } from "./helpers.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

// Database modules load only after the switch to the test database.
const { guard, skip, prisma } = await openTestDatabase();
const { PAGINATION } = guard.ok ? await import("../services/productService.js") : {};
const { ADMIN_PAGINATION } = guard.ok ? await import("../services/adminCatalogService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const RUN = crypto.randomBytes(4).toString("hex");
const userIds = [];
const created = { users: [], products: [], categories: [] };
let server, admin, customer;

// The largest page whose offset (page - 1) * maxLimit is a safe integer.
const maxPageFor = ({ maxLimit }) => Math.floor(Number.MAX_SAFE_INTEGER / maxLimit);

const LISTS = {
    public: { path: "/products", limits: PAGINATION, headers: () => ({}) },
    admin: { path: "/admin/products", limits: ADMIN_PAGINATION, headers: () => admin },
};

async function makeUser(role) {
    const user = await prisma.user.create({
        data: { email: `p125-${role.toLowerCase()}-${RUN}@example.test`, passwordHash: "not-a-login", firstName: "Test", lastName: role, role },
    });
    userIds.push(user.id);
    created.users.push({ id: user.id, email: user.email });
    return { Authorization: `Bearer ${signAccessToken(user)}` };
}

async function get(path, query, headers = {}) {
    const res = await fetch(`${server.url}${path}${query}`, { headers });
    return { status: res.status, body: await res.json() };
}

// 422 naming `field`, never a 500.
async function rejects(list, query, field) {
    const { status, body } = await get(list.path, query, list.headers());
    assert.equal(status, 422, `${list.path}${query} -> ${status} ${JSON.stringify(body)}`);
    assert.equal(body.details[0].field, field, `${list.path}${query}`);
}

before(async () => {
    if (!guard.ok) return;

    // Before any write: this process is on the test database.
    await assertOnTestDatabase(prisma);

    admin = await makeUser("ADMIN");
    customer = await makeUser("CUSTOMER");

    const category = await prisma.category.create({ data: { name: `P125 ${RUN}`, slug: `p125-${RUN}` } });
    created.categories.push({ id: category.id, slug: category.slug });
    for (const [suffix, brand, price, isActive] of [["a", "Nike", "19.99", true], ["b", "Adidas", "29.99", true], ["off", "Nike", "9.99", false]]) {
        const product = await prisma.product.create({
            data: {
                categoryId: category.id, name: `P125 ${RUN} ${suffix}`, slug: `p125-${RUN}-${suffix}`,
                description: "List validation fixture", brand, price, isActive,
                variants: { create: [{ sku: `P125-${RUN}-${suffix}`.toUpperCase(), size: "M", color: "Black", stock: 5 }] },
            },
        });
        created.products.push({ id: product.id, slug: product.slug, name: product.name });
    }

    // Active fillers so the public list (maxLimit 48) holds 100 rows and the
    // admin list (maxLimit 100, inactive included) holds 101: the largest page
    // must be cut by the cap. No variants, so stock and price filters ignore them.
    const fillers = 101 - created.products.length;
    await prisma.product.createMany({
        data: Array.from({ length: fillers }, (_, i) => ({
            categoryId: category.id, name: `P125 ${RUN} filler ${i}`, slug: `p125-${RUN}-filler-${i}`,
            description: "List validation filler", brand: "Filler", price: "5.00", isActive: true,
        })),
    });
    const saved = await prisma.product.findMany({ where: { slug: { startsWith: `p125-${RUN}-filler-` } }, select: { id: true, slug: true, name: true } });
    assert.equal(saved.length, fillers, "every filler was created");
    created.products.push(...saved);

    server = await startServer(testServerEnv(guard));

    // The server reads a product that exists only in this run.
    const probe = await get(`/products/${created.products[0].id}`, "");
    assert.equal(probe.body?.data?.name, created.products[0].name, "server is on the test database");
});

after(async () => {
    if (!guard.ok) return;

    try {
        // Only this run's rows: its users' refresh tokens, the users, its
        // products (variants cascade) and its category.
        await deleteInTestDatabase(prisma, async (tx) => {
            await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
            expectDeleted("users", await tx.user.deleteMany({
                where: { id: { in: created.users.map((u) => u.id) }, email: { in: created.users.map((u) => u.email) } },
            }), created.users.length);
            expectDeleted("products", await tx.product.deleteMany({
                where: { id: { in: created.products.map((p) => p.id) }, slug: { in: created.products.map((p) => p.slug) } },
            }), created.products.length);
            expectDeleted("categories", await tx.category.deleteMany({
                where: { id: { in: created.categories.map((c) => c.id) }, slug: { in: created.categories.map((c) => c.slug) } },
            }), created.categories.length);
        });
    } finally {
        await server?.stop();
        await prisma.$disconnect();
    }
});

for (const [name, list] of Object.entries(LISTS)) {
    dbTest(`${name}: repeated page/limit are rejected, not a 500`, async () => {
        await rejects(list, "?page=1&page=2", "page");
        await rejects(list, "?page=2&page=2", "page");
        await rejects(list, "?limit=5&limit=6", "limit");
        await rejects(list, "?page=1&limit=5&limit=5", "limit");
    });

    dbTest(`${name}: integers beyond the safe range are rejected, not a 500`, async () => {
        const maxPage = maxPageFor(list.limits);

        for (const page of ["99999999999999999999", "9007199254740993", String(Number.MAX_SAFE_INTEGER), String(maxPage + 1)]) {
            await rejects(list, `?page=${page}`, "page");
        }
        await rejects(list, "?limit=99999999999999999999", "limit");
    });

    dbTest(`${name}: invalid page/limit values are rejected consistently`, async () => {
        for (const page of ["0", "-1", "-0", "1.5", "abc", "1e3", " ", "0x10"]) {
            await rejects(list, `?page=${encodeURIComponent(page)}`, "page");
        }
        for (const limit of ["0", "-5", "2.5", "abc", String(list.limits.maxLimit + 1)]) {
            await rejects(list, `?limit=${encodeURIComponent(limit)}`, "limit");
        }
    });

    dbTest(`${name}: valid boundaries still work with the same response shape`, async () => {
        const first = await get(list.path, "", list.headers());
        assert.equal(first.status, 200);
        assert.deepEqual(Object.keys(first.body).sort(), ["data", "pagination", "success"]);
        assert.deepEqual(Object.keys(first.body.pagination).sort(), ["limit", "page", "total", "totalPages"]);
        assert.equal(first.body.pagination.page, 1);
        assert.equal(first.body.pagination.limit, list.limits.defaultLimit);
        const { total } = first.body.pagination;
        // The fixtures hold more rows than the largest page, so every limit below must cut the page.
        assert.ok(total > list.limits.maxLimit, `fixtures exceed maxLimit (${total} > ${list.limits.maxLimit})`);
        assert.equal(first.body.data.length, list.limits.defaultLimit);

        // Empty values mean "not given".
        const blank = await get(list.path, "?page=&limit=", list.headers());
        assert.deepEqual(blank.body.pagination, first.body.pagination);

        // Smallest and largest limit.
        const one = await get(list.path, "?limit=1", list.headers());
        assert.equal(one.status, 200);
        assert.equal(one.body.data.length, 1);
        const most = await get(list.path, `?limit=${list.limits.maxLimit}`, list.headers());
        assert.equal(most.status, 200);
        assert.equal(most.body.data.length, list.limits.maxLimit, "the largest page holds exactly maxLimit rows");
        assert.equal(most.body.pagination.limit, list.limits.maxLimit);

        // The rows past the cap are on the next page, not lost or repeated.
        const rest = await get(list.path, `?page=2&limit=${list.limits.maxLimit}`, list.headers());
        assert.equal(rest.status, 200);
        assert.equal(rest.body.data.length, Math.min(list.limits.maxLimit, total - list.limits.maxLimit));
        const firstPage = new Set(most.body.data.map((p) => p.id));
        assert.ok(!rest.body.data.some((p) => firstPage.has(p.id)), "page 2 does not repeat page 1");

        // Pages of limit=1 line up with one larger page (pagination unchanged).
        const second = await get(list.path, "?page=2&limit=1", list.headers());
        if (total >= 2) assert.equal(second.body.data[0].id, most.body.data[1].id);

        // The largest page, even with the largest limit: an empty page, not an error.
        const maxPage = maxPageFor(list.limits);
        const last = await get(list.path, `?page=${maxPage}&limit=${list.limits.maxLimit}`, list.headers());
        assert.equal(last.status, 200);
        assert.deepEqual(last.body.data, []);
        assert.equal(last.body.pagination.page, maxPage);
        assert.equal(last.body.pagination.total, total);

        // A leading zero or plus sign was accepted before and still is.
        assert.equal((await get(list.path, "?page=01", list.headers())).body.pagination.page, 1);
        assert.equal((await get(list.path, "?page=%2B2", list.headers())).body.pagination.page, 2);
    });
}

dbTest("public: other single-value filters reject repeats; list filters still accept them", async () => {
    const list = LISTS.public;
    await rejects(list, "?sort=newest&sort=price-asc", "sort");
    await rejects(list, "?minPrice=1&minPrice=2", "minPrice");
    await rejects(list, "?maxPrice=10&maxPrice=20", "maxPrice");
    await rejects(list, "?inStock=true&inStock=false", "inStock");

    // Unchanged: repeated list filters, and valid sort/filter/page combinations.
    const byBrand = await get(list.path, "?brand=nike&brand=adidas");
    const byComma = await get(list.path, "?brand=nike,adidas");
    assert.equal(byBrand.status, 200);
    assert.deepEqual(byBrand.body, byComma.body);

    const sorted = await get(list.path, "?sort=price-asc&inStock=true&minPrice=0&maxPrice=1000&page=1&limit=10");
    assert.equal(sorted.status, 200);
    const prices = sorted.body.data.map((p) => p.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

dbTest("admin: other single-value filters reject repeats; auth still comes first", async () => {
    const list = LISTS.admin;
    await rejects(list, "?isActive=true&isActive=false", "isActive");
    await rejects(list, "?categoryId=1&categoryId=2", "categoryId");

    const inactive = await get(list.path, "?isActive=false&page=1&limit=5", admin);
    assert.equal(inactive.status, 200);
    assert.ok(inactive.body.data.length > 0, "the run's inactive product is listed");
    assert.ok(inactive.body.data.every((p) => p.isActive === false));

    // Bad parameters never reveal anything to non-admins.
    assert.equal((await get(list.path, "?page=1&page=2")).status, 401);
    assert.equal((await get(list.path, "?page=1&page=2", customer)).status, 403);
});
