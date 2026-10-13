// Dynamic brand filter: GET /products/brands lists the catalog's real brands,
// and every listed brand filters GET /products. Read-only: uses the current
// development catalog and creates no records.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { brandSlug, toBrandOptions } from "../services/productService.js";
import { slugify } from "../services/adminCatalogService.js";
import { startServer } from "./helpers.js";

const group = (brand, count = 1) => ({ brand, _count: { _all: count } });

// ---------------------------------------------------------------------------
// toBrandOptions (no database)
// ---------------------------------------------------------------------------

test("null, empty and whitespace-only brands are left out", () => {
    const options = toBrandOptions([group(null, 9), group("", 2), group("   ", 3), group("\t", 1), group("Apple", 4)]);

    assert.deepEqual(options, [{ slug: "apple", name: "Apple", names: ["Apple"], productCount: 4 }]);
});

test("options are sorted by name, case-insensitively", () => {
    const names = toBrandOptions([group("zara"), group("Apple"), group("H&M"), group("adidas")]).map((o) => o.name);

    assert.deepEqual(names, ["adidas", "Apple", "H&M", "zara"]);
});

test("spellings that share a slug become one option that sends all of them", () => {
    const [option] = toBrandOptions([group("H&M", 3), group("HM", 1)]);

    assert.equal(option.slug, "hm");
    assert.equal(option.name, "H&M", "the most-used spelling is displayed");
    assert.deepEqual(option.names.sort(), ["H&M", "HM"]);
    assert.equal(option.productCount, 4);
});

test("stored values are sent as stored; only the display name is trimmed", () => {
    const [option] = toBrandOptions([group(" Apple ", 2)]);

    assert.equal(option.name, "Apple");
    assert.deepEqual(option.names, [" Apple "]);
});

test("brand slugs follow the existing slug rule, so old links keep working", () => {
    for (const name of ["Nike", "Levi's", "H&M", "Calvin Klein", "New Balance", "Dolce & Gabbana", "Fashion Co.", "Apple"]) {
        assert.equal(brandSlug(name), slugify(name), name);
    }
    assert.equal(brandSlug("Levi's"), "levis");
    assert.equal(brandSlug("H&M"), "hm");
    assert.equal(brandSlug("&&"), "&&", "a symbols-only name still gets a slug");
});

// ---------------------------------------------------------------------------
// API (current catalog, read-only)
// ---------------------------------------------------------------------------

let server;

before(async () => { server = await startServer(); });
after(async () => { await server?.stop(); });

const get = async (path) => {
    const res = await fetch(`${server.url}${path}`);
    return { status: res.status, body: await res.json() };
};

const OLD_STATIC_BRANDS = ["Nike", "Adidas", "Puma", "New Balance", "Levi's", "Calvin Klein", "Tommy Hilfiger", "Zara", "H&M", "Uniqlo"];

test("GET /products/brands lists valid, unique brands", async () => {
    const { status, body } = await get("/products/brands");

    assert.equal(status, 200);
    assert.ok(body.data.length > 0);
    for (const brand of body.data) {
        assert.ok(brand.name.trim(), JSON.stringify(brand));
        assert.ok(brand.slug && brand.names.length && brand.productCount > 0, JSON.stringify(brand));
    }
    assert.equal(new Set(body.data.map((b) => b.slug)).size, body.data.length, "slugs are unique");
});

test("each brand's count matches what filtering by it returns", async () => {
    const { body } = await get("/products/brands");

    for (const brand of body.data) {
        const list = await get(`/products?limit=1&brand=${encodeURIComponent(brand.names.join(","))}`);
        assert.equal(list.body.pagination.total, brand.productCount, brand.name);
    }
});

test("a brand missing from the old hard-coded list can be filtered", async () => {
    const { body } = await get("/products/brands");
    const extra = body.data.find((b) => !OLD_STATIC_BRANDS.includes(b.name));
    assert.ok(extra, "the catalog has a brand outside the old static list");

    const list = await get(`/products?limit=48&brand=${encodeURIComponent(extra.names.join(","))}`);
    assert.equal(list.status, 200);
    assert.ok(list.body.data.length > 0);
    assert.ok(list.body.data.every((p) => extra.names.includes(p.brand)), "only that brand's products");
});

test("brand combines with category, search, sort and pagination", async () => {
    const { body } = await get("/products/brands");
    // A brand whose products span more than one page at limit=1.
    const brand = body.data.find((b) => b.productCount >= 2 && !OLD_STATIC_BRANDS.includes(b.name));
    assert.ok(brand);
    const value = encodeURIComponent(brand.names.join(","));

    const page1 = await get(`/products?brand=${value}&sort=price-asc&limit=1&page=1`);
    const page2 = await get(`/products?brand=${value}&sort=price-asc&limit=1&page=2`);
    assert.equal(page1.body.pagination.total, brand.productCount);
    assert.equal(page1.body.pagination.totalPages, brand.productCount);
    assert.ok(page1.body.data[0].price <= page2.body.data[0].price, "sorted across pages");
    assert.notEqual(page1.body.data[0].id, page2.body.data[0].id);

    // Category: the product's own category narrows to the same or fewer results.
    const slug = page1.body.data[0].category.slug;
    const inCategory = await get(`/products?brand=${value}&category=${encodeURIComponent(slug)}&limit=48`);
    assert.ok(inCategory.body.pagination.total >= 1 && inCategory.body.pagination.total <= brand.productCount);
    assert.ok(inCategory.body.data.every((p) => brand.names.includes(p.brand)));

    // Search: the brand's own product name keeps it; a nonsense term empties it.
    const named = await get(`/products?brand=${value}&search=${encodeURIComponent(page1.body.data[0].name)}`);
    assert.ok(named.body.data.some((p) => p.id === page1.body.data[0].id));
    const none = await get(`/products?brand=${value}&search=zzzz-no-such-product`);
    assert.equal(none.body.pagination.total, 0);
});

test("comma-separated and repeated ?brand= give the same results", async () => {
    const { body } = await get("/products/brands");
    const [a, b] = body.data.filter((x) => !OLD_STATIC_BRANDS.includes(x.name));

    const comma = await get(`/products?limit=48&brand=${encodeURIComponent(`${a.names[0]},${b.names[0]}`)}`);
    const repeated = await get(`/products?limit=48&brand=${encodeURIComponent(a.names[0])}&brand=${encodeURIComponent(b.names[0])}`);
    assert.equal(comma.body.pagination.total, a.productCount + b.productCount);
    assert.deepEqual(repeated.body.data.map((p) => p.id), comma.body.data.map((p) => p.id));
});

test("an unknown brand matches nothing", async () => {
    const list = await get("/products?brand=No%20Such%20Brand%20zzzz");

    assert.equal(list.status, 200);
    assert.equal(list.body.pagination.total, 0);
});
