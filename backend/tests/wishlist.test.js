// Wishlist: add, list, remove, duplicates, validation and ownership.
// The run creates its own users, category and products; wishlist rows go
// with them (ON DELETE CASCADE), and every row this run created is deleted
// in after(). No existing product, cart, order or stock is touched.
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

const { guard, skip, prisma } = await openTestDatabase();

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const RUN = crypto.randomBytes(4).toString("hex");
const created = { users: [], products: [], categories: [] };
let server, single, multi, inactive;

async function makeUser(label) {
    const user = await prisma.user.create({
        data: { email: `wishlist-${label}-${RUN}@example.test`, passwordHash: "not-a-login", firstName: "Test", lastName: label, role: "CUSTOMER" },
    });
    created.users.push({ id: user.id, email: user.email });
    // A new token each call, as after logging out and in again.
    const login = () => ({ Authorization: `Bearer ${signAccessToken(user)}` });
    return { id: user.id, headers: login(), login };
}

async function call(method, path, user, body) {
    const res = await fetch(`${server.url}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(user?.headers ?? {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
}

const rowsOf = (userId) => prisma.wishlistItem.count({ where: { userId } });

async function makeProduct(suffix, { isActive = true, variants }) {
    const slug = `wishlist-${RUN}-${suffix}`;
    const product = await prisma.product.create({
        data: {
            categoryId: created.categories[0].id, name: `Wishlist ${RUN} ${suffix}`, slug,
            description: "Wishlist test fixture", brand: "Nike", price: "30.00", isActive,
            variants: { create: variants.map(([size, stock]) => ({ sku: `WL-${RUN}-${suffix}-${size}`.toUpperCase(), size, color: "Black", stock })) },
        },
        include: { variants: true },
    });
    created.products.push({ id: product.id, slug });
    return product;
}

before(async () => {
    if (!guard.ok) return;

    await assertOnTestDatabase(prisma);

    const slug = `wishlist-${RUN}`;
    const category = await prisma.category.create({ data: { name: `Wishlist ${RUN}`, slug } });
    created.categories.push({ id: category.id, slug });

    single = await makeProduct("single", { variants: [["M", 5]] });
    multi = await makeProduct("multi", { variants: [["S", 0], ["L", 3]] });
    inactive = await makeProduct("inactive", { isActive: false, variants: [["M", 5]] });

    server = await startServer(testServerEnv(guard));

    const probe = await call("GET", `/products/${single.id}`);
    assert.equal(probe.body?.data?.name, `Wishlist ${RUN} single`, "server is on the test database");
});

after(async () => {
    if (!guard.ok) return;

    try {
        await deleteInTestDatabase(prisma, async (tx) => {
            const userIds = created.users.map((u) => u.id);
            await tx.wishlistItem.deleteMany({ where: { userId: { in: userIds } } });
            expectDeleted("users", await tx.user.deleteMany({
                where: { id: { in: userIds }, email: { in: created.users.map((u) => u.email) } },
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

dbTest("unauthenticated requests are rejected", async () => {
    assert.equal((await call("GET", "/wishlist")).status, 401);
    assert.equal((await call("PUT", `/wishlist/${single.id}`)).status, 401);
    assert.equal((await call("DELETE", `/wishlist/${single.id}`)).status, 401);
});

dbTest("add, list and remove; repeats are harmless and create no duplicates", async () => {
    const a = await makeUser("owner");

    assert.deepEqual((await call("GET", "/wishlist", a)).body, { success: true, data: [] });

    const first = await call("PUT", `/wishlist/${single.id}`, a);
    assert.equal(first.status, 201);
    assert.deepEqual(first.body.data, { productId: single.id, added: true });

    const again = await call("PUT", `/wishlist/${single.id}`, a);
    assert.equal(again.status, 200);
    assert.equal(again.body.data.added, false);

    // Simultaneous adds (double click, two tabs): still one row.
    const burst = await Promise.all(Array.from({ length: 5 }, () => call("PUT", `/wishlist/${multi.id}`, a)));
    assert.ok(burst.every((res) => [200, 201].includes(res.status)));
    assert.equal(burst.filter((res) => res.body.data.added).length, 1);
    assert.equal(await rowsOf(a.id), 2);

    // Newest first, in the catalog list-item shape.
    const list = (await call("GET", "/wishlist", a)).body.data;
    assert.deepEqual(list.map((p) => p.id), [multi.id, single.id]);
    const [m, s] = list;
    assert.equal(s.name, `Wishlist ${RUN} single`);
    assert.equal(s.price, 30);
    assert.equal(s.inStock, true);
    assert.equal(s.variantId, single.variants[0].id, "one variant: can go straight to the cart");
    assert.equal(s.variantStock, 5);
    assert.equal(m.variantId, null, "several variants: size must be chosen");
    assert.ok(s.addedAt);
    for (const field of ["userId", "user", "variants", "description"]) {
        assert.ok(!(field in s), `${field} is not exposed`);
    }

    const removed = await call("DELETE", `/wishlist/${single.id}`, a);
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.data, { productId: single.id, removed: true });
    const repeat = await call("DELETE", `/wishlist/${single.id}`, a);
    assert.equal(repeat.status, 200);
    assert.equal(repeat.body.data.removed, false);
    assert.deepEqual((await call("GET", "/wishlist", a)).body.data.map((p) => p.id), [multi.id]);
});

dbTest("entries persist across sessions (a new login sees them)", async () => {
    const a = await makeUser("returning");
    await call("PUT", `/wishlist/${single.id}`, a);

    const relogin = { headers: a.login() };
    assert.deepEqual((await call("GET", "/wishlist", relogin)).body.data.map((p) => p.id), [single.id]);
});

dbTest("invalid, missing and inactive products are refused", async () => {
    const a = await makeUser("validation");

    for (const bad of ["abc", "0", "-1", "1.5", "99999999999"]) {
        assert.equal((await call("PUT", `/wishlist/${bad}`, a)).status, 422, bad);
        assert.equal((await call("DELETE", `/wishlist/${bad}`, a)).status, 422, bad);
    }

    const missing = await call("PUT", "/wishlist/2147483000", a);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, "Product not found");
    assert.equal((await call("PUT", `/wishlist/${inactive.id}`, a)).status, 404, "inactive looks missing, as in the catalog");
    assert.equal(await rowsOf(a.id), 0);

    // A saved product that is deactivated later is hidden, not deleted.
    await call("PUT", `/wishlist/${single.id}`, a);
    await prisma.product.update({ where: { id: single.id }, data: { isActive: false } });
    try {
        assert.deepEqual((await call("GET", "/wishlist", a)).body.data, []);
        assert.equal(await rowsOf(a.id), 1);
    } finally {
        await prisma.product.update({ where: { id: single.id }, data: { isActive: true } });
    }
});

dbTest("one customer cannot read or change another's wishlist", async () => {
    const a = await makeUser("alice");
    const b = await makeUser("bob");
    await call("PUT", `/wishlist/${single.id}`, a);

    // The owner comes only from the token; a userId in the body is ignored.
    assert.deepEqual((await call("GET", "/wishlist", b)).body.data, []);
    const removed = await call("DELETE", `/wishlist/${single.id}`, b, { userId: a.id });
    assert.equal(removed.body.data.removed, false);
    await call("PUT", `/wishlist/${multi.id}`, b, { userId: a.id });

    assert.deepEqual((await call("GET", "/wishlist", a)).body.data.map((p) => p.id), [single.id]);
    assert.deepEqual((await call("GET", "/wishlist", b)).body.data.map((p) => p.id), [multi.id]);
});
