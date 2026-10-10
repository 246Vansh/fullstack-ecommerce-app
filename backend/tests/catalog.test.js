// Catalog search treats LIKE wildcards literally, the guest-cart batch lookup
// returns the same data as GET /products/:id, and the server shuts down
// gracefully. Uses two throwaway products; after() removes them.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { stripVTControlCharacters } from "node:util";
import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { escapeLike } from "../services/productService.js";
import { startServer, runNode, freePort } from "./helpers.js";

const RUN = crypto.randomBytes(4).toString("hex");
let server, categoryId, literal, lookalike, inactive;

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
    server = await startServer();
    categoryId = (await prisma.category.findFirst({ where: { parentId: { not: null }, isActive: true } })).id;
    // Only "%" and "_" differ between the two names.
    literal = await fixture(`P10 ${RUN} 100% off_sale`, "LIT");
    lookalike = await fixture(`P10 ${RUN} 100X offXsale`, "LOOK");
    inactive = await fixture(`P10 ${RUN} hidden`, "OFF", false);
});

after(async () => {
    try {
        await prisma.product.deleteMany({ where: { id: { in: [literal, lookalike, inactive].filter(Boolean).map((p) => p.id) } } });
    } finally {
        await server.stop();
        await prisma.$disconnect();
    }
});

// ------------------------------------------------------------ search escaping

test("unit: escapeLike escapes %, _ and the escape character only", () => {
    assert.equal(escapeLike("100%"), "100\\%");
    assert.equal(escapeLike("off_sale"), "off\\_sale");
    assert.equal(escapeLike("a\\b"), "a\\\\b");
    assert.equal(escapeLike("T-Shirt (blue)"), "T-Shirt (blue)");
    assert.equal(escapeLike(""), "");
});

test("search: % is a literal character, not a wildcard", async () => {
    const { ids } = await search(`${RUN} 100%`);
    assert.deepEqual(ids, [literal.id]);

    // A bare "%" matches only products that contain one, not the whole catalog.
    const all = await prisma.product.findMany({ where: { isActive: true }, select: { name: true, brand: true, description: true } });
    const withPercent = all.filter((p) => [p.name, p.brand, p.description].some((v) => v?.includes("%"))).length;
    assert.equal((await search("%")).total, withPercent);
});

test("search: _ is a literal character, not a single-character wildcard", async () => {
    assert.deepEqual((await search(`${RUN} 100% off_`)).ids, [literal.id]);
    assert.deepEqual((await search("off_sale")).ids, [literal.id]);

    const all = await prisma.product.findMany({ where: { isActive: true }, select: { name: true, brand: true, description: true } });
    const withUnderscore = all.filter((p) => [p.name, p.brand, p.description].some((v) => v?.includes("_"))).length;
    assert.equal((await search("_")).total, withUnderscore);
});

test("search: normal text still matches as before", async () => {
    const { ids } = await search(`P10 ${RUN}`);
    assert.deepEqual(ids.sort(), [literal.id, lookalike.id].sort(), "inactive product stays hidden");
    assert.deepEqual((await search(`${RUN} 100X`)).ids, [lookalike.id]);
    assert.ok((await search("nike")).total >= 2, "case-insensitive brand match still works");
});

test("search: empty search returns the unfiltered catalog", async () => {
    const res = await fetch(`${server.url}/products?limit=1&search=`);
    const unfiltered = await fetch(`${server.url}/products?limit=1`);
    assert.equal((await res.json()).pagination.total, (await unfiltered.json()).pagination.total);
});

test("search: mixed text with both wildcards and a backslash", async () => {
    assert.deepEqual((await search(`${RUN} 100% off_sale`)).ids, [literal.id]);
    assert.deepEqual((await search(`${RUN} 100\\`)).ids, [], "backslash is literal too");
});

// ------------------------------------------------------------ batch lookup

test("batch: same shape as GET /products/:id, missing and inactive ids left out", async () => {
    const res = await fetch(`${server.url}/products/batch?ids=${lookalike.id},${literal.id},${literal.id},${inactive.id},2147483647`);
    assert.equal(res.status, 200);
    const { data } = await res.json();

    assert.deepEqual(data.map((p) => p.id), [literal.id, lookalike.id].sort((a, b) => a - b));

    for (const product of data) {
        const single = (await (await fetch(`${server.url}/products/${product.id}`)).json()).data;
        assert.deepEqual(product, single);
    }
});

test("batch: accepts repeated ids; rejects empty, non-numeric, out-of-range and oversized lists", async () => {
    const repeated = await fetch(`${server.url}/products/batch?ids=${literal.id}&ids=${lookalike.id}`);
    assert.equal((await repeated.json()).data.length, 2);

    for (const query of ["", "ids=", "ids=abc", "ids=0", "ids=-1", "ids=1.5", "ids=2147483648"]) {
        const res = await fetch(`${server.url}/products/batch?${query}`);
        assert.equal(res.status, 422, query);
    }

    const tooMany = Array.from({ length: 49 }, (_, i) => i + 1).join(",");
    assert.equal((await fetch(`${server.url}/products/batch?ids=${tooMany}`)).status, 422);
});

test("batch: does not change GET /products/:id", async () => {
    assert.equal((await fetch(`${server.url}/products/${literal.id}`)).status, 200);
    assert.equal((await fetch(`${server.url}/products/${inactive.id}`)).status, 404);
    assert.equal((await fetch(`${server.url}/products/abc`)).status, 422);
});

// ------------------------------------------------------------ graceful shutdown

test("shutdown: SIGTERM lets an in-flight request finish, refuses new ones, exits 0", async () => {
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
    const result = await runNode(["--input-type=module", "-e", script], { PORT: String(port) }, 20000);
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
