// Query validation for the public and admin product lists: repeated
// parameters, unsafe integers and invalid page/limit values are 422 (they
// used to be 500s), while valid values and boundaries behave as before.
// Read-only apart from one throwaway admin account (no orders), removed in after().
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import prisma from "../config/db.js";
import { signAccessToken } from "../utils/jwt.js";
import { PAGINATION } from "../services/productService.js";
import { ADMIN_PAGINATION } from "../services/adminCatalogService.js";
import { startServer } from "./helpers.js";

const RUN = crypto.randomBytes(4).toString("hex");
const userIds = [];
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
    server = await startServer();
    admin = await makeUser("ADMIN");
    customer = await makeUser("CUSTOMER");
});

after(async () => {
    try {
        await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
        await server.stop();
        await prisma.$disconnect();
    }
});

for (const [name, list] of Object.entries(LISTS)) {
    test(`${name}: repeated page/limit are rejected, not a 500`, async () => {
        await rejects(list, "?page=1&page=2", "page");
        await rejects(list, "?page=2&page=2", "page");
        await rejects(list, "?limit=5&limit=6", "limit");
        await rejects(list, "?page=1&limit=5&limit=5", "limit");
    });

    test(`${name}: integers beyond the safe range are rejected, not a 500`, async () => {
        const maxPage = maxPageFor(list.limits);

        for (const page of ["99999999999999999999", "9007199254740993", String(Number.MAX_SAFE_INTEGER), String(maxPage + 1)]) {
            await rejects(list, `?page=${page}`, "page");
        }
        await rejects(list, "?limit=99999999999999999999", "limit");
    });

    test(`${name}: invalid page/limit values are rejected consistently`, async () => {
        for (const page of ["0", "-1", "-0", "1.5", "abc", "1e3", " ", "0x10"]) {
            await rejects(list, `?page=${encodeURIComponent(page)}`, "page");
        }
        for (const limit of ["0", "-5", "2.5", "abc", String(list.limits.maxLimit + 1)]) {
            await rejects(list, `?limit=${encodeURIComponent(limit)}`, "limit");
        }
    });

    test(`${name}: valid boundaries still work with the same response shape`, async () => {
        const first = await get(list.path, "", list.headers());
        assert.equal(first.status, 200);
        assert.deepEqual(Object.keys(first.body).sort(), ["data", "pagination", "success"]);
        assert.deepEqual(Object.keys(first.body.pagination).sort(), ["limit", "page", "total", "totalPages"]);
        assert.equal(first.body.pagination.page, 1);
        assert.equal(first.body.pagination.limit, list.limits.defaultLimit);
        const { total } = first.body.pagination;

        // Empty values mean "not given".
        const blank = await get(list.path, "?page=&limit=", list.headers());
        assert.deepEqual(blank.body.pagination, first.body.pagination);

        // Smallest and largest limit.
        const one = await get(list.path, "?limit=1", list.headers());
        assert.equal(one.status, 200);
        assert.equal(one.body.data.length, Math.min(1, total));
        const most = await get(list.path, `?limit=${list.limits.maxLimit}`, list.headers());
        assert.equal(most.status, 200);
        assert.equal(most.body.data.length, Math.min(list.limits.maxLimit, total));

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

test("public: other single-value filters reject repeats; list filters still accept them", async () => {
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

test("admin: other single-value filters reject repeats; auth still comes first", async () => {
    const list = LISTS.admin;
    await rejects(list, "?isActive=true&isActive=false", "isActive");
    await rejects(list, "?categoryId=1&categoryId=2", "categoryId");

    const inactive = await get(list.path, "?isActive=false&page=1&limit=5", admin);
    assert.equal(inactive.status, 200);
    assert.ok(inactive.body.data.every((p) => p.isActive === false));

    // Bad parameters never reveal anything to non-admins.
    assert.equal((await get(list.path, "?page=1&page=2")).status, 401);
    assert.equal((await get(list.path, "?page=1&page=2", customer)).status, 403);
});
