// Dynamic brand filter: GET /products/brands lists the catalog's real brands,
// and every listed brand filters GET /products. Uses two throwaway categories
// and four products under two brands unique to this run; after() removes them.
//
// Writes only to the test database named by TEST_DATABASE_URL (see
// testDatabase.js); unset, these tests are skipped and nothing connects. The
// toBrandOptions/brandSlug unit tests are skipped too: productService loads
// the database client.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

import { startServer } from "./helpers.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

// Database modules load only after the switch to the test database.
const { guard, skip, prisma } = await openTestDatabase();
const { brandSlug, toBrandOptions } = guard.ok ? await import("../services/productService.js") : {};
const { slugify } = guard.ok ? await import("../services/adminCatalogService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const RUN = crypto.randomBytes(4).toString("hex");
const group = (brand, count = 1) => ({ brand, _count: { _all: count } });

// ---------------------------------------------------------------------------
// toBrandOptions
// ---------------------------------------------------------------------------

dbTest("null, empty and whitespace-only brands are left out", () => {
    const options = toBrandOptions([group(null, 9), group("", 2), group("   ", 3), group("\t", 1), group("Apple", 4)]);

    assert.deepEqual(options, [{ slug: "apple", name: "Apple", names: ["Apple"], productCount: 4 }]);
});

dbTest("options are sorted by name, case-insensitively", () => {
    const names = toBrandOptions([group("zara"), group("Apple"), group("H&M"), group("adidas")]).map((o) => o.name);

    assert.deepEqual(names, ["adidas", "Apple", "H&M", "zara"]);
});

dbTest("spellings that share a slug become one option that sends all of them", () => {
    const [option] = toBrandOptions([group("H&M", 3), group("HM", 1)]);

    assert.equal(option.slug, "hm");
    assert.equal(option.name, "H&M", "the most-used spelling is displayed");
    assert.deepEqual(option.names.sort(), ["H&M", "HM"]);
    assert.equal(option.productCount, 4);
});

dbTest("stored values are sent as stored; only the display name is trimmed", () => {
    const [option] = toBrandOptions([group(" Apple ", 2)]);

    assert.equal(option.name, "Apple");
    assert.deepEqual(option.names, [" Apple "]);
});

dbTest("brand slugs follow the existing slug rule, so old links keep working", () => {
    for (const name of ["Nike", "Levi's", "H&M", "Calvin Klein", "New Balance", "Dolce & Gabbana", "Fashion Co.", "Apple"]) {
        assert.equal(brandSlug(name), slugify(name), name);
    }
    assert.equal(brandSlug("Levi's"), "levis");
    assert.equal(brandSlug("H&M"), "hm");
    assert.equal(brandSlug("&&"), "&&", "a symbols-only name still gets a slug");
});

// ---------------------------------------------------------------------------
// API (this run's fixtures)
// ---------------------------------------------------------------------------

const OLD_STATIC_BRANDS = ["Nike", "Adidas", "Puma", "New Balance", "Levi's", "Calvin Klein", "Tommy Hilfiger", "Zara", "H&M", "Uniqlo"];

// Two brands outside the old static list. ALPHA has three products at distinct
// prices across two categories (so it spans pages at limit=1 and a category
// narrows it); BETA has one.
const ALPHA = `Brandtest ${RUN} Alpha`;
const BETA = `Brandtest ${RUN} Beta`;

let server, categories = [], products = [];

const createCategory = (key) => prisma.category.create({ data: { name: `Brandtest ${RUN} ${key}`, slug: `brandtest-${key}-${RUN}` } });

const createProduct = (key, brand, category, price) => prisma.product.create({
    data: {
        categoryId: category.id, name: `Brandtest ${RUN} ${key}`, slug: `brandtest-${key}-${RUN}`,
        description: "Brand test fixture", brand, price: new Prisma.Decimal(price),
        variants: { create: [{ sku: `BRANDTEST-${RUN}-${key}`.toUpperCase(), size: "M", color: "Black", stock: 5 }] },
    },
});

before(async () => {
    if (!guard.ok) return;

    // Before any write: this process is on the test database.
    await assertOnTestDatabase(prisma);

    const shoes = await createCategory("shoes");
    categories.push(shoes);
    const bags = await createCategory("bags");
    categories.push(bags);
    for (const [key, brand, category, price] of [
        ["alpha-1", ALPHA, shoes, "10.00"],
        ["alpha-2", ALPHA, shoes, "20.00"],
        ["alpha-3", ALPHA, bags, "30.00"],
        ["beta-1", BETA, bags, "15.00"],
    ]) {
        products.push(await createProduct(key, brand, category, price));
    }

    server = await startServer(testServerEnv(guard));

    // The server reads a product that exists only in this run.
    const probe = await (await fetch(`${server.url}/products/${products[0].id}`)).json();
    assert.equal(probe?.data?.name, products[0].name, "server is on the test database");
});

after(async () => {
    if (!guard.ok) return;

    try {
        // Only this run's products (variants cascade), then its categories.
        await deleteInTestDatabase(prisma, async (tx) => {
            if (products.length) {
                expectDeleted("products", await tx.product.deleteMany({
                    where: { id: { in: products.map((p) => p.id) }, slug: { in: products.map((p) => p.slug) } },
                }), products.length);
            }
            if (categories.length) {
                expectDeleted("categories", await tx.category.deleteMany({
                    where: { id: { in: categories.map((c) => c.id) }, slug: { in: categories.map((c) => c.slug) } },
                }), categories.length);
            }
        });
    } finally {
        await server?.stop();
        await prisma.$disconnect();
    }
});

const get = async (path) => {
    const res = await fetch(`${server.url}${path}`);
    return { status: res.status, body: await res.json() };
};

// This run's brand option from GET /products/brands.
const option = (body, name) => {
    const found = body.data.find((b) => b.name === name);
    assert.ok(found, `${name} is listed`);
    return found;
};

dbTest("GET /products/brands lists valid, unique brands", async () => {
    const { status, body } = await get("/products/brands");

    assert.equal(status, 200);
    assert.ok(body.data.length > 0);
    for (const brand of body.data) {
        assert.ok(brand.name.trim(), JSON.stringify(brand));
        assert.ok(brand.slug && brand.names.length && brand.productCount > 0, JSON.stringify(brand));
    }
    assert.equal(new Set(body.data.map((b) => b.slug)).size, body.data.length, "slugs are unique");

    assert.deepEqual(option(body, ALPHA), { slug: brandSlug(ALPHA), name: ALPHA, names: [ALPHA], productCount: 3 });
    assert.deepEqual(option(body, BETA), { slug: brandSlug(BETA), name: BETA, names: [BETA], productCount: 1 });
});

dbTest("each brand's count matches what filtering by it returns", async () => {
    const { body } = await get("/products/brands");

    for (const brand of body.data) {
        const list = await get(`/products?limit=1&brand=${encodeURIComponent(brand.names.join(","))}`);
        assert.equal(list.body.pagination.total, brand.productCount, brand.name);
    }
});

dbTest("a brand missing from the old hard-coded list can be filtered", async () => {
    const { body } = await get("/products/brands");
    const extra = option(body, BETA);
    assert.ok(!OLD_STATIC_BRANDS.includes(extra.name), "the catalog has a brand outside the old static list");

    const list = await get(`/products?limit=48&brand=${encodeURIComponent(extra.names.join(","))}`);
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length > 0);
    assert.ok(list.body.data.every((p) => extra.names.includes(p.brand)), "only that brand's products");
    assert.deepEqual(list.body.data.map((p) => p.id), [products[3].id]);
});

dbTest("brand combines with category, search, sort and pagination", async () => {
    const { body } = await get("/products/brands");
    // A brand whose products span more than one page at limit=1.
    const brand = option(body, ALPHA);
    assert.ok(brand.productCount >= 2 && !OLD_STATIC_BRANDS.includes(brand.name));
    const value = encodeURIComponent(brand.names.join(","));

    const page1 = await get(`/products?brand=${value}&sort=price-asc&limit=1&page=1`);
    const page2 = await get(`/products?brand=${value}&sort=price-asc&limit=1&page=2`);
    assert.equal(page1.body.pagination.total, brand.productCount);
    assert.equal(page1.body.pagination.totalPages, brand.productCount);
    assert.ok(page1.body.data[0].price <= page2.body.data[0].price, "sorted across pages");
    assert.notEqual(page1.body.data[0].id, page2.body.data[0].id);
    assert.deepEqual([page1.body.data[0].id, page2.body.data[0].id], [products[0].id, products[1].id]);

    // Category: the product's own category narrows to the same or fewer results.
    const slug = page1.body.data[0].category.slug;
    const inCategory = await get(`/products?brand=${value}&category=${encodeURIComponent(slug)}&limit=48`);
    assert.ok(inCategory.body.pagination.total >= 1 && inCategory.body.pagination.total <= brand.productCount);
    assert.ok(inCategory.body.data.every((p) => brand.names.includes(p.brand)));
    assert.equal(inCategory.body.pagination.total, 2, "two of ALPHA's three products are in its first product's category");

    // Search: the brand's own product name keeps it; a nonsense term empties it.
    const named = await get(`/products?brand=${value}&search=${encodeURIComponent(page1.body.data[0].name)}`);
    assert.ok(named.body.data.some((p) => p.id === page1.body.data[0].id));
    const none = await get(`/products?brand=${value}&search=zzzz-no-such-product`);
    assert.equal(none.body.pagination.total, 0);
});

dbTest("comma-separated and repeated ?brand= give the same results", async () => {
    const { body } = await get("/products/brands");
    const [a, b] = [option(body, ALPHA), option(body, BETA)];

    const comma = await get(`/products?limit=48&brand=${encodeURIComponent(`${a.names[0]},${b.names[0]}`)}`);
    const repeated = await get(`/products?limit=48&brand=${encodeURIComponent(a.names[0])}&brand=${encodeURIComponent(b.names[0])}`);
    assert.equal(comma.body.pagination.total, a.productCount + b.productCount);
    assert.deepEqual(repeated.body.data.map((p) => p.id), comma.body.data.map((p) => p.id));
    assert.deepEqual(comma.body.data.map((p) => p.id).sort((x, y) => x - y), products.map((p) => p.id).sort((x, y) => x - y));
});

dbTest("an unknown brand matches nothing", async () => {
    const list = await get(`/products?brand=${encodeURIComponent(`No Such Brand ${RUN} zzzz`)}`);

    assert.equal(list.status, 200);
    assert.equal(list.body.pagination.total, 0);
});
