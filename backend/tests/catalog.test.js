// Catalog search treats LIKE wildcards literally, the guest-cart batch lookup
// returns the same data as GET /products/:id, and the server shuts down
// gracefully. Uses its own category and three throwaway products; after()
// removes them.
//
// Writes only to the test database named by TEST_DATABASE_URL (see
// testDatabase.js); unset, these tests are skipped and nothing connects. The
// escapeLike unit test is skipped too: productService loads the database client.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { stripVTControlCharacters } from "node:util";
import { Prisma } from "@prisma/client";

import { startServer, runNode, freePort } from "./helpers.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

// Database modules load only after the switch to the test database.
const { guard, skip, prisma } = await openTestDatabase();
const { escapeLike } = guard.ok ? await import("../services/productService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const RUN = crypto.randomBytes(4).toString("hex");
let server, category, categoryId, literal, lookalike, inactive;

// GET /products?search=... -> ids of the matching products (up to 48).
async function search(term) {
    const res = await fetch(`${server.url}/products?limit=48&search=${encodeURIComponent(term)}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    return { total: body.pagination.total, ids: body.data.map((p) => p.id) };
}

const fixture = (name, sku, isActive = true) => prisma.product.create({
    data: {
        categoryId, name, slug: `phase10-${sku}-${RUN}`.toLowerCase(),
        description: "Catalog test fixture", brand: "Nike", price: new Prisma.Decimal("19.99"), isActive,
        variants: { create: [{ sku: `P10-${RUN}-${sku}`, size: "M", color: "Black", stock: 5 }] },
    },
});

before(async () => {
    if (!guard.ok) return;

    // Before any write: this process is on the test database.
    await assertOnTestDatabase(prisma);

    category = await prisma.category.create({ data: { name: `P10 ${RUN}`, slug: `phase10-${RUN}` } });
    categoryId = category.id;
    // Only "%" and "_" differ between the two names.
    literal = await fixture(`P10 ${RUN} 100% off_sale`, "LIT");
    lookalike = await fixture(`P10 ${RUN} 100X offXsale`, "LOOK");
    inactive = await fixture(`P10 ${RUN} hidden`, "OFF", false);

    server = await startServer(testServerEnv(guard));

    // The server reads a product that exists only in this run.
    const probe = await (await fetch(`${server.url}/products/${literal.id}`)).json();
    assert.equal(probe?.data?.name, literal.name, "server is on the test database");
});

after(async () => {
    if (!guard.ok) return;

    try {
        // Only this run's products (variants cascade), then its category.
        const products = [literal, lookalike, inactive].filter(Boolean);
        await deleteInTestDatabase(prisma, async (tx) => {
            expectDeleted("products", await tx.product.deleteMany({
                where: { id: { in: products.map((p) => p.id) }, slug: { in: products.map((p) => p.slug) } },
            }), products.length);
            if (category) expectDeleted("categories", await tx.category.deleteMany({ where: { id: category.id, slug: category.slug } }), 1);
        });
    } finally {
        await server?.stop();
        await prisma.$disconnect();
    }
});

// ------------------------------------------------------------ search escaping

dbTest("unit: escapeLike escapes %, _ and the escape character only", () => {
    assert.equal(escapeLike("100%"), "100\\%");
    assert.equal(escapeLike("off_sale"), "off\\_sale");
    assert.equal(escapeLike("a\\b"), "a\\\\b");
    assert.equal(escapeLike("T-Shirt (blue)"), "T-Shirt (blue)");
    assert.equal(escapeLike(""), "");
});

dbTest("search: % is a literal character, not a wildcard", async () => {
    const { ids } = await search(`${RUN} 100%`);
    assert.deepEqual(ids, [literal.id]);

    // A bare "%" matches only products that contain one, not the whole catalog.
    const all = await prisma.product.findMany({ where: { isActive: true }, select: { name: true, brand: true, description: true } });
    const withPercent = all.filter((p) => [p.name, p.brand, p.description].some((v) => v?.includes("%"))).length;
    assert.equal((await search("%")).total, withPercent);
});

dbTest("search: _ is a literal character, not a single-character wildcard", async () => {
    assert.deepEqual((await search(`${RUN} 100% off_`)).ids, [literal.id]);
    assert.deepEqual((await search("off_sale")).ids, [literal.id]);

    const all = await prisma.product.findMany({ where: { isActive: true }, select: { name: true, brand: true, description: true } });
    const withUnderscore = all.filter((p) => [p.name, p.brand, p.description].some((v) => v?.includes("_"))).length;
    assert.equal((await search("_")).total, withUnderscore);
});

dbTest("search: normal text still matches as before", async () => {
    const { ids } = await search(`P10 ${RUN}`);
    assert.deepEqual(ids.sort(), [literal.id, lookalike.id].sort(), "inactive product stays hidden");
    assert.deepEqual((await search(`${RUN} 100X`)).ids, [lookalike.id]);
    assert.ok((await search("nike")).total >= 2, "case-insensitive brand match still works");
});

dbTest("search: empty search returns the unfiltered catalog", async () => {
    const res = await fetch(`${server.url}/products?limit=1&search=`);
    const unfiltered = await fetch(`${server.url}/products?limit=1`);
    assert.equal((await res.json()).pagination.total, (await unfiltered.json()).pagination.total);
});

dbTest("search: mixed text with both wildcards and a backslash", async () => {
    assert.deepEqual((await search(`${RUN} 100% off_sale`)).ids, [literal.id]);
    assert.deepEqual((await search(`${RUN} 100\\`)).ids, [], "backslash is literal too");
});

// ------------------------------------------------------------ batch lookup

dbTest("batch: same shape as GET /products/:id, missing and inactive ids left out", async () => {
    const res = await fetch(`${server.url}/products/batch?ids=${lookalike.id},${literal.id},${literal.id},${inactive.id},2147483647`);
    assert.equal(res.status, 200);
    const { data } = await res.json();

    assert.deepEqual(data.map((p) => p.id), [literal.id, lookalike.id].sort((a, b) => a - b));

    for (const product of data) {
        const single = (await (await fetch(`${server.url}/products/${product.id}`)).json()).data;
        assert.deepEqual(product, single);
    }
});

dbTest("batch: accepts repeated ids; rejects empty, non-numeric, out-of-range and oversized lists", async () => {
    const repeated = await fetch(`${server.url}/products/batch?ids=${literal.id}&ids=${lookalike.id}`);
    assert.equal((await repeated.json()).data.length, 2);

    for (const query of ["", "ids=", "ids=abc", "ids=0", "ids=-1", "ids=1.5", "ids=2147483648"]) {
        const res = await fetch(`${server.url}/products/batch?${query}`);
        assert.equal(res.status, 422, query);
    }

    const tooMany = Array.from({ length: 49 }, (_, i) => i + 1).join(",");
    assert.equal((await fetch(`${server.url}/products/batch?ids=${tooMany}`)).status, 422);
});

dbTest("batch: does not change GET /products/:id", async () => {
    assert.equal((await fetch(`${server.url}/products/${literal.id}`)).status, 200);
    assert.equal((await fetch(`${server.url}/products/${inactive.id}`)).status, 404);
    assert.equal((await fetch(`${server.url}/products/abc`)).status, 422);
});

// ------------------------------------------------------------ graceful shutdown

dbTest("shutdown: SIGTERM lets an in-flight request finish, refuses new ones, exits 0", async () => {
    const port = await freePort();
    // Signals cannot be sent to a child on Windows, so the child emits its own
    // SIGTERM while a slow request (bcrypt login) is still running.
    const script = `
        await import("./server.js");
        const base = "http://127.0.0.1:${port}/api";
        while (!(await fetch(base + "/health").then(() => true, () => false))) await new Promise((r) => setTimeout(r, 50));
        const inflight = fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "nobody-${RUN}@example.test", password: "wrong-password-1" }) });
        setTimeout(async () => {
            process.emit("SIGTERM");
            const refused = await fetch(base + "/health", { headers: { Connection: "close" } }).then(() => false, () => true);
            console.log("NEW_REQUEST_REFUSED", refused);
        }, 100);
        const res = await inflight;
        console.log("INFLIGHT_STATUS", res.status);
    `;
    const started = Date.now();
    const result = await runNode(["--input-type=module", "-e", script], { ...testServerEnv(guard), PORT: String(port) }, 20000);
    // console.log colors numbers/booleans when FORCE_COLOR is inherited; match on plain text.
    const { code } = result;
    const output = stripVTControlCharacters(result.output);

    assert.equal(code, 0, output);
    assert.match(output, /SIGTERM received, shutting down/);
    assert.match(output, /INFLIGHT_STATUS 401/, "in-flight request completed");
    assert.match(output, /NEW_REQUEST_REFUSED true/);
    assert.doesNotMatch(output, /Shutdown timed out/);
    assert.ok(Date.now() - started < 10000, "exits well before the forced timeout");
});
