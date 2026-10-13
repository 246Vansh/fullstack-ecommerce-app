// DummyJSON product importer (scripts/importDummyJsonProducts.js): source
// validation, field mapping and the local-target guard. No database access.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
    CATEGORY_MAP, buildPlan, categoryName, categorySlugFor, classifyProducts, partialImportError, planCategories,
    skuFor, slugFor, slugPrefixFor, targetProblems, toProductData, validateSource,
} from "../scripts/importDummyJsonProducts.js";

const product = (overrides = {}) => ({
    id: 1, title: "Essence Mascara Lash Princess", description: "Volumizing mascara.", category: "beauty",
    price: 9.99, discountPercentage: 10.48, stock: 99, brand: "Essence",
    images: ["https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp"],
    ...overrides,
});
const body = (products, extra = {}) => ({ products, total: products.length, skip: 0, limit: products.length, ...extra });

test("a complete, consistent response passes", () => {
    const { errors, products } = validateSource(body([product(), product({ id: 2, title: "Other" })]));
    assert.deepEqual(errors, []);
    assert.equal(products.length, 2);
});

test("count mismatches and truncated responses are rejected", () => {
    assert.match(validateSource(body([product()], { total: 194 })).errors.join(), /returned 1 products but total is 194/);
    assert.match(validateSource(body([product()], { limit: 30 })).errors.join(), /limit 30/);
    assert.match(validateSource(body([product()], { skip: 30 })).errors.join(), /skip/);
    assert.deepEqual(validateSource({}).errors, ["response has no products array"]);
    assert.deepEqual(validateSource(null).errors, ["response has no products array"]);
});

test("invalid records and duplicate ids are rejected", () => {
    const bad = [
        product({ id: 0 }), product({ id: 3, title: "" }), product({ id: 4, price: -1 }), product({ id: 5, price: 1.234 }),
        product({ id: 6, stock: 1.5 }), product({ id: 7, images: [] }), product({ id: 8, images: ["http://evil.example/x.png"] }),
        product({ id: 9, category: "Bad Category" }), product({ id: 10, brand: "x".repeat(101) }),
        product({ id: 11, price: 100_000_000 }),
    ];
    const { errors } = validateSource(body(bad));
    for (const field of ["id", "title", "price", "stock", "images", "category", "brand"]) {
        assert.ok(errors.some((e) => e.includes(`invalid ${field}`)), field);
    }
    assert.equal(errors.filter((e) => e.includes("invalid price")).length, 3);
    assert.match(validateSource(body([product(), product()])).errors.join(), /duplicate product id 1/);
});

test("keys are namespaced by source id and never collide between ids", () => {
    assert.equal(skuFor(1), "DUMMYJSON-1");
    assert.equal(slugFor(product()), "dummyjson-1-essence-mascara-lash-princess");
    // "dummyjson-1-" must not match product 10's slug.
    assert.ok(!slugFor(product({ id: 10 })).startsWith(slugPrefixFor(1)));
    // Same title, different id -> different slug (the source has a duplicate title).
    assert.notEqual(slugFor(product({ id: 2 })), slugFor(product({ id: 3 })));
});

test("fields map to the schema without invented values", () => {
    const data = toProductData(product());
    assert.equal(data.price, "9.99");
    assert.equal(data.originalPrice, null, "discountPercentage does not become a sale price");
    assert.equal(data.brand, "Essence");
    assert.equal(data.isNew, false);
    assert.deepEqual(data.variants.create, [{ sku: "DUMMYJSON-1", size: null, color: null, colorHex: null, price: null, originalPrice: null, stock: 99, isActive: true }]);
    assert.deepEqual(data.images.create[0], { url: product().images[0], altText: "Essence Mascara Lash Princess", position: 0 });
    assert.equal(toProductData(product({ brand: undefined, description: "  " })).brand, null);
    assert.equal(toProductData(product({ brand: undefined, description: "  " })).description, null);
});

test("only content-matching categories reuse seeded ones", () => {
    assert.equal(categorySlugFor("mens-shirts"), "men-shirts");
    assert.equal(categorySlugFor("sunglasses"), "accessories-sunglasses");
    assert.equal(categorySlugFor("tops"), "tops", "DummyJSON 'tops' are dresses; not filed under women-tops");
    assert.equal(categorySlugFor("laptops"), "laptops");
    assert.ok(!Object.values(CATEGORY_MAP).includes("women-tops"));
    assert.equal(categoryName("home-decoration"), "Home Decoration");
});

test("writes need development mode, a loopback URL and this machine's server", () => {
    const env = { NODE_ENV: "development", DATABASE_URL: "mysql://u:p@127.0.0.1:3306/ecommerce" };
    const local = { env, serverHostname: "DEV-PC", machineHostname: "dev-pc" };

    assert.deepEqual(targetProblems(local), []);
    assert.deepEqual(targetProblems({ ...local, env: { ...env, DATABASE_URL: "mysql://u:p@localhost/ecommerce" } }), []);

    assert.match(targetProblems({ ...local, env: { ...env, NODE_ENV: "production" } }).join(), /NODE_ENV/);
    assert.match(targetProblems({ ...local, env: { ...env, NODE_ENV: undefined } }).join(), /NODE_ENV/);
    assert.match(targetProblems({ ...local, env: { ...env, DATABASE_URL: "mysql://u:p@db.example.com/ecommerce" } }).join(), /not a loopback/);
    assert.match(targetProblems({ ...local, env: { ...env, DATABASE_URL: undefined } }).join(), /not a URL/);
    // A tunnel to a remote server: loopback URL, but the server is another machine.
    assert.match(targetProblems({ ...local, serverHostname: "prod-db-1" }).join(), /not this machine/);
    assert.match(targetProblems({ ...local, serverHostname: undefined }).join(), /could not read/);
});

// ---------------------------------------------------------------------------
// Matching existing rows and planning writes (plain objects, no database)
// ---------------------------------------------------------------------------

// An existing product row as loadExisting returns it.
const row = (id, name, slug, skus) => ({ id, name, slug, skus });
const importedRow = (source, id = 500) => row(id, source.title, slugFor(source), [skuFor(source.id)]);

test("a product holding both keys is already imported, even if renamed", () => {
    const source = product();
    const { imported, conflicts, pending } = classifyProducts([source], [{ ...importedRow(source), name: "Renamed by admin" }]);

    assert.deepEqual(imported.map((i) => i.productId), [500]);
    assert.equal(conflicts.length, 0);
    assert.equal(pending.length, 0);
});

test("one key edited by an admin still counts as imported while the title matches", () => {
    const source = product();
    const slugEdited = { ...importedRow(source), slug: "admin-chosen-slug" };
    const skuEdited = { ...importedRow(source), skus: ["ADMIN-SKU-1"] };

    assert.equal(classifyProducts([source], [slugEdited]).imported.length, 1);
    assert.equal(classifyProducts([source], [skuEdited]).imported.length, 1);
});

test("an unrelated product holding the SKU is a conflict, not a silent skip", () => {
    const source = product();
    const { imported, conflicts, pending } = classifyProducts([source], [row(7, "Hand-made Tee", "hand-made-tee", ["DUMMYJSON-1"])]);

    assert.equal(imported.length, 0);
    assert.equal(pending.length, 0);
    assert.match(conflicts[0].note, /SKU DUMMYJSON-1 is held by unrelated product #7 "Hand-made Tee"/);
});

test("an unrelated product holding the slug prefix is a conflict", () => {
    const { conflicts } = classifyProducts([product()], [row(8, "Something Else", "dummyjson-1-something-else", ["X-1"])]);

    assert.match(conflicts[0].note, /slug prefix dummyjson-1- is held by unrelated product #8/);
});

test("keys split across two products is a conflict", () => {
    const source = product();
    const rows = [row(9, source.title, "other-slug", [skuFor(1)]), row(10, source.title, slugFor(source), ["Y-1"])];
    const { conflicts, imported } = classifyProducts([source], rows);

    assert.equal(imported.length, 0);
    assert.match(conflicts[0].note, /held by different products: #9 .*#10/);
});

test("keys compare case-insensitively, like the unique indexes", () => {
    const source = product();
    const lower = row(11, "Unrelated", "unrelated", ["dummyjson-1"]);

    assert.equal(classifyProducts([source], [lower]).conflicts.length, 1);
    assert.equal(classifyProducts([source], [{ ...importedRow(source), slug: slugFor(source).toUpperCase() }]).imported.length, 1);
});

test("product 1's keys never match product 10's rows", () => {
    const ten = product({ id: 10, title: "Ten" });
    const { pending, conflicts } = classifyProducts([product()], [importedRow(ten)]);

    assert.equal(pending.length, 1);
    assert.equal(conflicts.length, 0);
});

test("category plan: reuse, create, and conflicts", () => {
    const sources = [product({ category: "mens-shirts" }), product({ id: 2, category: "laptops" }), product({ id: 3, category: "beauty" })];
    const plans = planCategories(sources, [{ id: 3, slug: "men-shirts", name: "Shirts" }, { id: 40, slug: "beauty", name: "Beauty" }]);

    assert.deepEqual(plans.map((p) => [p.source, p.action]), [["mens-shirts", "reuse"], ["laptops", "create"], ["beauty", "reuse"]]);
    assert.equal(plans[1].name, "Laptops");

    // Same slug, unrelated category: never filed under it.
    const taken = planCategories([product({ category: "laptops" })], [{ id: 41, slug: "laptops", name: "Lap Desks" }]);
    assert.equal(taken[0].action, "conflict");
    assert.match(taken[0].note, /belongs to category "Lap Desks"/);

    // A mapped seeded category that was removed.
    const missing = planCategories([product({ category: "mens-shirts" })], []);
    assert.equal(missing[0].action, "conflict");
    assert.match(missing[0].note, /mapped category "men-shirts" does not exist/);
});

test("write plan: only missing products are created, categories only for them", () => {
    const done = product({ category: "beauty" });
    const fresh = product({ id: 2, title: "Fresh", category: "laptops" });
    const plan = buildPlan([done, fresh], { rows: [importedRow(done)], categories: [{ id: 40, slug: "beauty", name: "Beauty" }] });

    assert.equal(plan.canWrite, true);
    assert.deepEqual(plan.imported.map((i) => i.product.id), [1]);
    assert.deepEqual(plan.pending.map((p) => p.id), [2]);
    assert.deepEqual(plan.categories.map((c) => [c.source, c.action]), [["laptops", "create"]]);
});

test("write plan: a full re-run creates nothing", () => {
    const sources = [product(), product({ id: 2, title: "Two" })];
    const plan = buildPlan(sources, { rows: sources.map((s, i) => importedRow(s, 600 + i)), categories: [] });

    assert.equal(plan.canWrite, true);
    assert.equal(plan.pending.length, 0);
    assert.equal(plan.categories.length, 0);
});

test("write plan: any product or category conflict blocks every write", () => {
    const keyClash = buildPlan([product(), product({ id: 2, title: "Two" })], {
        rows: [row(7, "Hand-made Tee", "hand-made-tee", ["DUMMYJSON-1"])], categories: [{ id: 40, slug: "beauty", name: "Beauty" }],
    });
    assert.equal(keyClash.canWrite, false);
    assert.equal(keyClash.conflicts.length, 1);
    assert.equal(keyClash.pending.length, 1, "the other product is planned but not written while blocked");

    const categoryClash = buildPlan([product({ category: "laptops" })], { rows: [], categories: [{ id: 41, slug: "laptops", name: "Lap Desks" }] });
    assert.equal(categoryClash.canWrite, false);
    assert.equal(categoryClash.categoryConflicts.length, 1);
});

test("an unexpected error after writes began reports a possibly partial import", () => {
    const cause = new Error("Connection lost");
    const error = partialImportError(cause, { products: 42, categories: 3 });

    assert.match(error.message, /unexpected error after writes began: Connection lost/);
    assert.match(error.message, /may be partial: 42 product\(s\) and 3 categories were created in this run/);
    assert.match(error.message, /run the dry run .* then run it again with --write/);
    assert.equal(error.cause, cause, "the original error is kept for debugging");
    assert.match(partialImportError(cause, { products: 0, categories: 1 }).message, /0 product\(s\) and 1 category were/);
});
