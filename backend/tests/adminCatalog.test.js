// Admin catalog API: ADMIN-only access, validation and normalization, safe
// deactivation, stock invariants and category rules. Uses throwaway users,
// categories and products tagged with RUN; after() removes all of them.
//
// Writes only to the test database named by TEST_DATABASE_URL (see
// testDatabase.js); unset, these tests are skipped and nothing connects.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { signAccessToken } from "../utils/jwt.js";
import { startServer } from "./helpers.js";
import {
    openTestDatabase, testDatabaseGuardTest, testServerEnv, assertOnTestDatabase, deleteInTestDatabase, expectDeleted,
} from "./testDatabase.js";

// Database modules load only after the switch to the test database.
const { guard, skip, prisma } = await openTestDatabase();
const { createOrder } = guard.ok ? await import("../services/orderService.js") : {};

const dbTest = (name, fn) => test(name, { skip }, fn);
testDatabaseGuardTest(test, guard);

const RUN = crypto.randomBytes(4).toString("hex");
const userIds = [];
const userEmails = [];
const productIds = [];
const categoryIds = [];
let server, admin, customer, demoted, categoryId, inactiveCategoryId;

async function makeUser(label, role) {
    const user = await prisma.user.create({
        data: { email: `p12-${label}-${RUN}@example.test`, passwordHash: "not-a-login", firstName: "Test", lastName: label, role },
    });
    userIds.push(user.id);
    userEmails.push(user.email);
    return { id: user.id, headers: { Authorization: `Bearer ${signAccessToken(user)}` } };
}

async function call(method, path, user, body) {
    const res = await fetch(`${server.url}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...(user?.headers ?? {}) },
        body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
}

const sku = (suffix) => `p12-${RUN}-${suffix}`;

const productBody = (suffix, overrides = {}) => ({
    name: `  P12 ${RUN} ${suffix}  `,
    brand: "Testbrand",
    description: "Admin catalog fixture",
    price: "49.90",
    originalPrice: 59.9,
    categoryId,
    variants: [
        { sku: sku(`${suffix}-m`), size: "M", color: "Black", colorHex: "#00aa11", stock: 5 },
        { sku: sku(`${suffix}-l`), size: "L", color: "Black", stock: 0, price: "54.90" },
    ],
    images: [{ url: "https://images.example.com/a.jpg", altText: "Front" }, { url: "https://images.example.com/b.jpg" }],
    ...overrides,
});

async function createProduct(suffix, overrides) {
    const { status, body } = await call("POST", "/admin/products", admin, productBody(suffix, overrides));
    assert.equal(status, 201, JSON.stringify(body));
    productIds.push(body.data.id);
    return body.data;
}

before(async () => {
    if (!guard.ok) return;

    // Before any write: this process is on the test database.
    await assertOnTestDatabase(prisma);

    admin = await makeUser("admin", "ADMIN");
    customer = await makeUser("customer", "CUSTOMER");
    // A token still claiming ADMIN for a user whose role is now CUSTOMER.
    const demotedUser = await prisma.user.create({
        data: { email: `p12-demoted-${RUN}@example.test`, passwordHash: "x", firstName: "Test", lastName: "demoted", role: "CUSTOMER" },
    });
    userIds.push(demotedUser.id);
    userEmails.push(demotedUser.email);
    demoted = { headers: { Authorization: `Bearer ${signAccessToken({ id: demotedUser.id, role: "ADMIN" })}` } };

    const parent = await prisma.category.create({ data: { name: `P12 ${RUN}`, slug: `p12-${RUN}` } });
    const child = await prisma.category.create({ data: { name: `P12 ${RUN} Sub`, slug: `p12-${RUN}-sub`, parentId: parent.id } });
    const inactive = await prisma.category.create({ data: { name: `P12 ${RUN} Off`, slug: `p12-${RUN}-off`, isActive: false } });
    categoryIds.push(child.id, inactive.id, parent.id);
    categoryId = child.id;
    inactiveCategoryId = inactive.id;

    server = await startServer(testServerEnv(guard));

    // Before any request that writes: the server lists a category that exists
    // only in this run (a GET, so a misrouted server changes nothing).
    const probe = await (await fetch(`${server.url}/categories`)).json();
    assert.ok(JSON.stringify(probe).includes(`"p12-${RUN}"`), "server is on the test database");
});

after(async () => {
    if (!guard.ok) return;

    try {
        // Only this run's rows: its users' orders and carts, the products its
        // admin created (by id), the categories tagged with RUN (subcategories
        // first), then its users.
        await deleteInTestDatabase(prisma, async (tx) => {
            await tx.order.deleteMany({ where: { userId: { in: userIds } } });
            await tx.cart.deleteMany({ where: { userId: { in: userIds } } });
            const products = [...new Set(productIds)];
            expectDeleted("products", await tx.product.deleteMany({ where: { id: { in: products } } }), products.length);
            const extra = await tx.category.findMany({ where: { slug: { startsWith: `p12-${RUN}` } }, select: { id: true, parentId: true } });
            await tx.category.deleteMany({ where: { id: { in: extra.filter((c) => c.parentId).map((c) => c.id) } } });
            await tx.category.deleteMany({ where: { id: { in: extra.map((c) => c.id) } } });
            expectDeleted("users", await tx.user.deleteMany({ where: { id: { in: userIds }, email: { in: userEmails } } }), userIds.length);
        });
    } finally {
        await server?.stop();
        await prisma.$disconnect();
    }
});

// ------------------------------------------------------------ authorization

const ROUTES = [
    ["GET", "/admin/products"], ["POST", "/admin/products"], ["GET", "/admin/products/1"],
    ["PATCH", "/admin/products/1"], ["DELETE", "/admin/products/1"], ["PUT", "/admin/products/1/images"],
    ["POST", "/admin/products/1/variants"], ["PATCH", "/admin/variants/1"], ["DELETE", "/admin/variants/1"],
    ["GET", "/admin/categories"], ["POST", "/admin/categories"], ["PATCH", "/admin/categories/1"],
];

dbTest("auth: every admin route needs a token and refuses customers, even when they claim ADMIN", async () => {
    const forged = { headers: { Authorization: `Bearer ${jwt.sign({ sub: String(admin.id), role: "ADMIN", type: "access" }, "not-the-secret")}` } };
    const body = { role: "ADMIN", isAdmin: true, name: "x" };

    for (const [method, path] of ROUTES) {
        assert.equal((await call(method, path, null, body)).status, 401, `${method} ${path} anonymous`);
        assert.equal((await call(method, path, forged, body)).status, 401, `${method} ${path} forged token`);
        assert.equal((await call(method, path, customer, body)).status, 403, `${method} ${path} customer`);
        assert.equal((await call(method, `${path}?role=ADMIN`, customer, body)).status, 403, `${method} ${path} customer + query role`);
        assert.equal((await call(method, path, demoted, body)).status, 403, `${method} ${path} stale ADMIN token`);
    }

    assert.equal((await call("GET", "/admin/categories", admin)).status, 200);
});

// ------------------------------------------------------------ products

dbTest("products: create normalizes input, ignores unknown fields, and is visible publicly", async () => {
    const product = await createProduct("create", { id: 1, createdAt: "2000-01-01", orderItems: [], role: "ADMIN" });

    assert.equal(product.name, `P12 ${RUN} create`);
    assert.equal(product.slug, `testbrand-p12-${RUN}-create`);
    assert.equal(product.price, 49.9);
    assert.equal(product.originalPrice, 59.9);
    assert.equal(product.isActive, true);
    assert.notEqual(product.id, 1);
    assert.deepEqual(product.variants.map((v) => [v.sku, v.stock, v.effectivePrice]),
        [[sku("create-m").toUpperCase(), 5, 49.9], [sku("create-l").toUpperCase(), 0, 54.9]]);
    assert.equal(product.variants[0].colorHex, "#00AA11");
    assert.deepEqual(product.images.map((i) => [i.url, i.position]),
        [["https://images.example.com/a.jpg", 0], ["https://images.example.com/b.jpg", 1]]);

    const pub = await call("GET", `/products/${product.id}`);
    assert.equal(pub.status, 200);
    assert.deepEqual(Object.keys(pub.body.data).sort(),
        ["brand", "category", "createdAt", "description", "id", "image", "images", "inStock", "isNew", "name", "originalPrice", "price", "slug", "variants"]);
    assert.equal(pub.body.data.image, "https://images.example.com/a.jpg");
});

dbTest("products: invalid prices, stock, ids and payloads are rejected with 422", async () => {
    const invalid = [
        { price: 0 }, { price: -1 }, { price: "1.999" }, { price: 0.1 + 0.2 }, { price: 1e21 }, { price: "abc" },
        { price: "100000000.00" }, { price: true }, { price: undefined }, { originalPrice: "10" },
        { name: "   " }, { categoryId: "abc" }, { categoryId: 0 }, { slug: "Bad Slug!" },
        { variants: [] }, { variants: "nope" }, { variants: undefined },
        { variants: [{ sku: sku("bad1"), stock: -1 }] }, { variants: [{ sku: sku("bad2"), stock: 1.5 }] },
        { variants: [{ sku: sku("bad3"), stock: 1_000_001 }] }, { variants: [{ sku: "has space", stock: 1 }] },
        { variants: [{ stock: 1 }] }, { variants: [{ sku: sku("bad4"), colorHex: "red" }] },
        { images: [{ url: "http://insecure.example.com/a.jpg" }] }, { images: [{ url: "javascript:alert(1)" }] },
    ];

    for (const overrides of invalid) {
        const { status, body } = await call("POST", "/admin/products", admin, productBody("invalid", overrides));
        assert.equal(status, 422, `${JSON.stringify(overrides)} -> ${JSON.stringify(body)}`);
    }

    assert.equal((await call("GET", "/admin/products/abc", admin)).status, 422);
    assert.equal((await call("GET", "/admin/products/2147483648", admin)).status, 422);
    assert.equal((await call("GET", "/admin/products/2147483647", admin)).status, 404);
    assert.equal(await prisma.product.count({ where: { name: { contains: `${RUN} invalid` } } }), 0);
});

dbTest("products: duplicate and conflicting data return 409 without partial writes", async () => {
    const existing = await createProduct("dup");

    const sameSlug = await call("POST", "/admin/products", admin, productBody("dup2", {
        slug: existing.slug, variants: [{ sku: sku("dup2-x"), stock: 1 }],
    }));
    assert.equal(sameSlug.status, 409);
    assert.equal(sameSlug.body.details[0].field, "slug");

    const sameSku = await call("POST", "/admin/products", admin, productBody("dup3", { variants: [{ sku: sku("dup-m").toLowerCase(), stock: 1 }] }));
    assert.equal(sameSku.status, 409, "SKUs compare case-insensitively after normalization");
    assert.equal(sameSku.body.details[0].field, "sku");

    const repeatedOption = await call("POST", "/admin/products", admin, productBody("dup4", {
        variants: [{ sku: sku("dup4-a"), size: "M" }, { sku: sku("dup4-b"), size: "M" }],
    }));
    assert.equal(repeatedOption.status, 409);
    assert.equal(repeatedOption.body.details[0].field, "variant");

    const inactiveCategory = await call("POST", "/admin/products", admin, productBody("dup5", { categoryId: inactiveCategoryId }));
    assert.equal(inactiveCategory.status, 409);
    assert.equal(inactiveCategory.body.details[0].field, "categoryId");

    const missingCategory = await call("POST", "/admin/products", admin, productBody("dup6", { categoryId: 2147483647 }));
    assert.equal(missingCategory.status, 422);

    const wasPrice = await call("POST", "/admin/products", admin, productBody("dup7", { price: "60", originalPrice: "60" }));
    assert.equal(wasPrice.status, 422);
    assert.equal(wasPrice.body.details[0].field, "originalPrice");

    assert.equal(await prisma.product.count({ where: { name: { contains: `${RUN} dup` } } }), 1);
});

dbTest("products: PATCH updates only sent fields and checks the merged price pair", async () => {
    const product = await createProduct("patch");

    const updated = await call("PATCH", `/admin/products/${product.id}`, admin, { price: 39.99, originalPrice: null, isNew: true, slug: "  P12-Patched-" + RUN + " " });
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.data.price, 39.99);
    assert.equal(updated.body.data.originalPrice, null);
    assert.equal(updated.body.data.isNew, true);
    assert.equal(updated.body.data.slug, `p12-patched-${RUN}`);
    assert.equal(updated.body.data.name, product.name);

    assert.equal((await call("PATCH", `/admin/products/${product.id}`, admin, { originalPrice: 30 })).status, 422);
    assert.equal((await call("PATCH", `/admin/products/${product.id}`, admin, {})).status, 422);
    assert.equal((await call("PATCH", `/admin/products/${product.id}`, admin, { id: 5, role: "ADMIN" })).status, 422);
    assert.equal((await call("PATCH", `/admin/products/${product.id}`, admin, { categoryId: inactiveCategoryId })).status, 409);
    assert.equal((await call("PATCH", "/admin/products/2147483647", admin, { price: 10 })).status, 404);
});

dbTest("products: DELETE deactivates; carts and order history keep working and it can be restored", async () => {
    const product = await createProduct("deactivate");
    const variant = product.variants[0];

    assert.equal((await call("POST", "/cart/items", customer, { variantId: variant.id, quantity: 1 })).status, 201);
    const order = await prisma.order.create({
        data: {
            orderNumber: `P12-${RUN}`, userId: customer.id, subtotal: "49.90", total: "49.90",
            shippingFirstName: "T", shippingLastName: "B", shippingPhone: "1", shippingEmail: "t@example.test",
            shippingAddress: "1 St", shippingCity: "C", shippingState: "S", shippingZipCode: "1", shippingCountry: "US",
            items: { create: [{ productId: product.id, variantId: variant.id, productName: product.name, sku: variant.sku, unitPrice: "49.90", quantity: 1, lineTotal: "49.90" }] },
        },
    });

    const removed = await call("DELETE", `/admin/products/${product.id}`, admin);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.data.isActive, false);
    assert.equal(removed.body.data.orderItemCount, 1);

    assert.equal((await call("GET", `/products/${product.id}`)).status, 404, "hidden from the storefront");
    const cart = await call("GET", "/cart", customer);
    assert.equal(cart.body.data.items.find((i) => i.variant.id === variant.id).isAvailable, false);
    const item = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
    assert.equal(item.productId, product.id, "order item still linked");

    const admins = await call("GET", `/admin/products?isActive=false&search=${encodeURIComponent(`${RUN} deactivate`)}`, admin);
    assert.deepEqual(admins.body.data.map((p) => p.id), [product.id]);

    const restored = await call("PATCH", `/admin/products/${product.id}`, admin, { isActive: true });
    assert.equal(restored.body.data.isActive, true);
    assert.equal((await call("GET", `/products/${product.id}`)).status, 200);
    assert.equal((await call("DELETE", "/admin/products/2147483647", admin)).status, 404);
});

dbTest("images: PUT replaces the gallery in the given order", async () => {
    const product = await createProduct("images");

    const res = await call("PUT", `/admin/products/${product.id}/images`, admin, {
        images: [{ url: "https://images.example.com/c.jpg", altText: "  Side  " }, { url: "https://images.example.com/a.jpg", altText: "" }],
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.images.map((i) => [i.url, i.altText, i.position]),
        [["https://images.example.com/c.jpg", "Side", 0], ["https://images.example.com/a.jpg", null, 1]]);
    assert.equal((await call("GET", `/products/${product.id}`)).body.data.image, "https://images.example.com/c.jpg");

    assert.equal((await call("PUT", `/admin/products/${product.id}/images`, admin, {})).status, 422);
    assert.equal((await call("PUT", `/admin/products/${product.id}/images`, admin, { images: Array(21).fill({ url: "https://a.example.com/x.jpg" }) })).status, 422);
    assert.equal((await call("PUT", "/admin/products/2147483647/images", admin, { images: [] })).status, 404);
});

// ------------------------------------------------------------ variants and stock

dbTest("variants: create, update and deactivate with conflict checks", async () => {
    const product = await createProduct("variants");

    const added = await call("POST", `/admin/products/${product.id}/variants`, admin, { sku: sku("variants-xl"), size: "XL", color: "Black", stock: 3 });
    assert.equal(added.status, 201, JSON.stringify(added.body));
    const xl = added.body.data.variants.find((v) => v.size === "XL");

    assert.equal((await call("POST", `/admin/products/${product.id}/variants`, admin, { sku: sku("variants-xl2"), size: "XL", color: "Black" })).status, 409);
    assert.equal((await call("POST", `/admin/products/${product.id}/variants`, admin, { sku: xl.sku, size: "XXL" })).status, 409);
    assert.equal((await call("POST", "/admin/products/2147483647/variants", admin, { sku: sku("nope") })).status, 404);

    const repriced = await call("PATCH", `/admin/variants/${xl.id}`, admin, { price: "45.00", originalPrice: "50" });
    assert.equal(repriced.status, 200);
    assert.equal(repriced.body.data.variants.find((v) => v.id === xl.id).effectivePrice, 45);
    assert.equal((await call("PATCH", `/admin/variants/${xl.id}`, admin, { originalPrice: "40" })).status, 422);
    assert.equal((await call("PATCH", `/admin/variants/${xl.id}`, admin, { size: "M" })).status, 409);

    const off = await call("DELETE", `/admin/variants/${xl.id}`, admin);
    assert.equal(off.body.data.variants.find((v) => v.id === xl.id).isActive, false);
    const pub = (await call("GET", `/products/${product.id}`)).body.data;
    assert.ok(!pub.variants.some((v) => v.id === xl.id), "inactive variant hidden publicly");
    assert.equal((await call("POST", "/cart/items", customer, { variantId: xl.id, quantity: 1 })).status, 404);
    assert.equal((await call("DELETE", "/admin/variants/2147483647", admin)).status, 404);
});

dbTest("stock: absolute and relative updates never go negative, and concurrent decrements are not lost", async () => {
    const product = await createProduct("stock");
    const variantId = product.variants[0].id;
    const stockOf = async () => (await prisma.productVariant.findUnique({ where: { id: variantId } })).stock;

    assert.equal((await call("PATCH", `/admin/variants/${variantId}`, admin, { stock: 5 })).status, 200);
    assert.equal((await call("PATCH", `/admin/variants/${variantId}`, admin, { stockAdjustment: 3 })).status, 200);
    assert.equal(await stockOf(), 8);

    const tooMany = await call("PATCH", `/admin/variants/${variantId}`, admin, { stockAdjustment: -9 });
    assert.equal(tooMany.status, 409);
    assert.equal(await stockOf(), 8);

    for (const bad of [{ stock: -1 }, { stock: "five" }, { stockAdjustment: 0 }, { stockAdjustment: 1.5 }, { stock: 1, stockAdjustment: 1 }]) {
        assert.equal((await call("PATCH", `/admin/variants/${variantId}`, admin, bad)).status, 422, JSON.stringify(bad));
    }

    // Twelve parallel -1 adjustments against 8 units: exactly 8 succeed.
    const results = await Promise.all(Array.from({ length: 12 }, () => call("PATCH", `/admin/variants/${variantId}`, admin, { stockAdjustment: -1 })));
    assert.equal(results.filter((r) => r.status === 200).length, 8);
    assert.equal(results.filter((r) => r.status === 409).length, 4);
    assert.equal(await stockOf(), 0);
});

// ------------------------------------------------------------ categories

dbTest("categories: create, nest one level, and refuse unsafe changes", async () => {
    const top = await call("POST", "/admin/categories", admin, { name: `  P12 ${RUN} Top ` });
    assert.equal(top.status, 201, JSON.stringify(top.body));
    assert.equal(top.body.data.slug, `p12-${RUN}-top`);

    const sub = await call("POST", "/admin/categories", admin, { name: `P12 ${RUN} Kid`, parentId: top.body.data.id });
    assert.equal(sub.status, 201);

    assert.equal((await call("POST", "/admin/categories", admin, { name: "x", slug: `p12-${RUN}-top` })).status, 409);
    assert.equal((await call("POST", "/admin/categories", admin, { name: "x", slug: `p12-${RUN}-x`, parentId: sub.body.data.id })).status, 422, "no third level");
    assert.equal((await call("POST", "/admin/categories", admin, { name: "x", slug: `p12-${RUN}-y`, parentId: 2147483647 })).status, 422);
    assert.equal((await call("POST", "/admin/categories", admin, { name: "x", slug: `p12-${RUN}-z`, parentId: inactiveCategoryId })).status, 409);
    assert.equal((await call("POST", "/admin/categories", admin, { name: "" })).status, 422);
    assert.equal((await call("PATCH", `/admin/categories/${top.body.data.id}`, admin, { parentId: top.body.data.id })).status, 422);
    assert.equal((await call("PATCH", `/admin/categories/${top.body.data.id}`, admin, { parentId: categoryIds[2] })).status, 409, "has children");
    assert.equal((await call("PATCH", "/admin/categories/2147483647", admin, { name: "x" })).status, 404);

    // A category with active products (or active subcategories) cannot be hidden.
    await createProduct("cat", { categoryId: sub.body.data.id });
    assert.equal((await call("PATCH", `/admin/categories/${sub.body.data.id}`, admin, { isActive: false })).status, 409);
    assert.equal((await call("PATCH", `/admin/categories/${top.body.data.id}`, admin, { isActive: false })).status, 409);

    const renamed = await call("PATCH", `/admin/categories/${sub.body.data.id}`, admin, { description: "Kids", name: "  Kid Renamed " });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.data.name, "Kid Renamed");

    const list = await call("GET", "/admin/categories", admin);
    assert.ok(list.body.data.some((c) => c.id === inactiveCategoryId && c.isActive === false), "admin list includes inactive");
    const pub = await call("GET", "/categories");
    assert.ok(!pub.body.data.some((c) => c.id === inactiveCategoryId), "public list unchanged");
});

// ------------------------------------------------------------ concurrency (Phase 12.1.1)

const ROUNDS = 8;

dbTest("race: concurrent variants with a blank size never duplicate a size/color option", async () => {
    for (let round = 0; round < ROUNDS; round++) {
        const product = await createProduct(`race-opt-${round}`);
        const results = await Promise.all(Array.from({ length: 6 }, (_, i) => call("POST", `/admin/products/${product.id}/variants`, admin,
            { sku: sku(`race-opt-${round}-${i}`), size: null, color: "Blue", stock: 1 })));

        assert.equal(results.filter((r) => r.status === 201).length, 1, `round ${round}: ${results.map((r) => r.status)}`);
        assert.ok(results.every((r) => r.status === 201 || r.status === 409), `round ${round}: ${results.map((r) => r.status)}`);
        assert.equal(await prisma.productVariant.count({ where: { productId: product.id, size: null, color: "Blue" } }), 1);
    }
});

dbTest("prices: a product price or was-price change cannot invalidate a variant's displayed pair", async () => {
    const product = await createProduct("price-pair", { originalPrice: null });
    const [m] = product.variants; // inherits the product price (49.90)
    const l = product.variants[1]; // own price 54.90, inherits the product's was-price

    assert.equal((await call("PATCH", `/admin/variants/${m.id}`, admin, { originalPrice: "55.00" })).status, 200);

    const tooHigh = await call("PATCH", `/admin/products/${product.id}`, admin, { price: "55.00" });
    assert.equal(tooHigh.status, 409, JSON.stringify(tooHigh.body));
    assert.deepEqual(tooHigh.body.details.map((d) => d.field), [`variants[${m.id}].originalPrice`]);

    const lowWas = await call("PATCH", `/admin/products/${product.id}`, admin, { originalPrice: "54.90" });
    assert.equal(lowWas.status, 409, "variant L (54.90) would show a was-price that is not higher");

    // Rejected changes wrote nothing; a valid change still works and keeps exact cents.
    const current = await prisma.product.findUnique({ where: { id: product.id } });
    assert.equal(current.price.toFixed(2), "49.90");
    assert.equal(current.originalPrice, null);
    const ok = await call("PATCH", `/admin/products/${product.id}`, admin, { price: "54.89", originalPrice: "64.99" });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).price.toFixed(2), "54.89");

    // A variant may not take its own price up to the inherited was-price either.
    assert.equal((await call("PATCH", `/admin/variants/${l.id}`, admin, { price: "64.99" })).status, 422);
});

const pairIsValid = (variant, product) => {
    const price = Number(variant.price ?? product.price);
    const was = variant.originalPrice ?? product.originalPrice;
    return was == null || Number(was) > price;
};

dbTest("race: concurrent product and variant price edits never leave an invalid pair", async () => {
    for (let round = 0; round < ROUNDS; round++) {
        const product = await createProduct(`race-price-${round}`, { originalPrice: null });
        const variantId = product.variants[0].id;

        const results = await Promise.all([
            call("PATCH", `/admin/variants/${variantId}`, admin, { originalPrice: "55.00" }),
            call("PATCH", `/admin/products/${product.id}`, admin, { price: "60.00" }),
        ]);
        // Whichever commits first wins; the other is refused, never a 500.
        assert.equal(results.filter((r) => r.status === 200).length, 1, `round ${round}: ${results.map((r) => r.status)}`);

        const saved = await prisma.product.findUnique({ where: { id: product.id }, include: { variants: true } });
        for (const variant of saved.variants) {
            assert.ok(pairIsValid(variant, saved), `round ${round}: price ${saved.price}, variant was ${variant.originalPrice}`);
        }
    }
});

dbTest("race: deactivating a category never leaves active products or subcategories in it", async () => {
    const parent = await prisma.category.findUnique({ where: { slug: `p12-${RUN}` } });

    for (let round = 0; round < ROUNDS; round++) {
        const category = await prisma.category.create({ data: { name: `P12 ${RUN} Race ${round}`, slug: `p12-${RUN}-race-${round}`, parentId: parent.id } });
        const parked = await createProduct(`race-cat-park-${round}`, { isActive: false });
        await call("PATCH", `/admin/products/${parked.id}`, admin, { categoryId: category.id });

        const results = await Promise.all([
            call("PATCH", `/admin/categories/${category.id}`, admin, { isActive: false }),
            ...Array.from({ length: 3 }, (_, i) => call("POST", "/admin/products", admin, productBody(`race-cat-${round}-${i}`, {
                categoryId: category.id,
                variants: [{ sku: sku(`race-cat-${round}-${i}`), stock: 1 }],
            }))),
            call("PATCH", `/admin/products/${parked.id}`, admin, { isActive: true }),
        ]);
        results.forEach((r) => r.body.data?.variants && productIds.push(r.body.data.id));
        assert.ok(results.every((r) => r.status < 500), `round ${round}: ${results.map((r) => r.status)}`);

        const saved = await prisma.category.findUnique({ where: { id: category.id } });
        const active = await prisma.product.count({ where: { categoryId: category.id, isActive: true } });
        assert.ok(saved.isActive || active === 0, `round ${round}: inactive category with ${active} active products (${results.map((r) => r.status)})`);
    }

    // Same for an active subcategory created under a parent being deactivated.
    for (let round = 0; round < ROUNDS; round++) {
        const top = await prisma.category.create({ data: { name: `P12 ${RUN} RaceTop ${round}`, slug: `p12-${RUN}-racetop-${round}` } });
        const results = await Promise.all([
            call("PATCH", `/admin/categories/${top.id}`, admin, { isActive: false }),
            call("POST", "/admin/categories", admin, { name: `P12 ${RUN} RaceKid ${round}`, parentId: top.id }),
        ]);
        const saved = await prisma.category.findUnique({ where: { id: top.id } });
        const activeKids = await prisma.category.count({ where: { parentId: top.id, isActive: true } });
        assert.ok(saved.isActive || activeKids === 0, `round ${round}: inactive parent with ${activeKids} active subcategories`);
        assert.ok(results.every((r) => r.status < 500), `round ${round}: ${results.map((r) => r.status)}`);
    }
});

// ------------------------------------------------------------ lock-path audit (Phase 12.1.2)

dbTest("race: concurrent gallery replacements leave exactly one gallery, never a 500", async () => {
    for (let round = 0; round < ROUNDS; round++) {
        const product = await createProduct(`race-img-${round}`, { images: [] });
        const galleries = Array.from({ length: 4 }, (_, i) => [1, 2].map((n) => ({ url: `https://images.example.com/r${round}-g${i}-${n}.jpg` })));

        const results = await Promise.all(galleries.map((images) => call("PUT", `/admin/products/${product.id}/images`, admin, { images })));
        assert.ok(results.every((r) => r.status === 200 || r.status === 409), `round ${round}: ${results.map((r) => r.status)}`);

        const saved = (await prisma.productImage.findMany({ where: { productId: product.id }, orderBy: { position: "asc" } })).map((i) => i.url);
        assert.ok(galleries.some((g) => JSON.stringify(g.map((i) => i.url)) === JSON.stringify(saved)), `round ${round}: mixed gallery ${saved}`);
    }
});

dbTest("race: cross-moving two categories under each other fails cleanly, never a 500", async () => {
    for (let round = 0; round < ROUNDS; round++) {
        const [a, b] = await Promise.all(["x", "y"].map((n) => prisma.category.create({ data: { name: `P12 ${RUN} X${round}${n}`, slug: `p12-${RUN}-cross-${round}-${n}` } })));

        const results = await Promise.all([
            call("PATCH", `/admin/categories/${a.id}`, admin, { parentId: b.id }),
            call("PATCH", `/admin/categories/${b.id}`, admin, { parentId: a.id }),
        ]);
        assert.ok(results.every((r) => r.status === 200 || r.status === 409 || r.status === 422), `round ${round}: ${results.map((r) => r.status)}`);

        // Never a three-level tree: at most one of the two became a subcategory.
        const saved = await prisma.category.findMany({ where: { id: { in: [a.id, b.id] } } });
        assert.ok(saved.filter((c) => c.parentId !== null).length <= 1, `round ${round}: both moved`);
    }
});

dbTest("lock order: an admin variant edit during order placement lets both succeed (no deadlock)", async () => {
    const product = await createProduct("lock-order");
    const variantId = product.variants[0].id;
    const address = await call("POST", "/addresses", customer, {
        firstName: "Test", lastName: "Buyer", phone: "5551234567", address: "1 Lock Street",
        city: "Austin", state: "TX", zipCode: "73301", country: "United States",
    });
    assert.equal(address.status, 201, JSON.stringify(address.body));
    await call("DELETE", "/cart", customer);
    assert.equal((await call("POST", "/cart/items", customer, { variantId, quantity: 1 })).status, 201);

    // Pause the order right after it decrements stock (variant row locked) and,
    // while it waits, start an admin edit of that variant and the product's price
    // check. The order then writes its items (which share-lock the product row).
    let adminEdit;
    const order = await createOrder(customer.id, { addressId: address.body.data.id }, {
        afterStep: async (name) => {
            if (name !== "stock") return;
            adminEdit = call("PATCH", `/admin/variants/${variantId}`, admin, { originalPrice: "79.00", stockAdjustment: 2 });
            await new Promise((ok) => setTimeout(ok, 400));
        },
    });

    assert.equal(order.items.length, 1);
    const edit = await adminEdit;
    assert.equal(edit.status, 200, JSON.stringify(edit.body));
    assert.equal(edit.body.data.variants[0].stock, 5 - 1 + 2, "admin change applied on top of the order's decrement");
});
