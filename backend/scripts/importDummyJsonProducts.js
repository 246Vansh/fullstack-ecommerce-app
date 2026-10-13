// Imports the DummyJSON product catalogue (https://dummyjson.com/products) into
// the LOCAL DEVELOPMENT database, for catalogue coverage while developing.
// It is separate from prisma/seed.js; the normal seed never imports external data.
//
//   pnpm catalog:import-dummyjson            dry run: fetch, validate, report
//   pnpm catalog:import-dummyjson --write    create the missing products
//
// Additive only. It never updates or deletes an existing row: a product that
// was already imported is skipped, so stock, prices, admin edits, carts and
// order history are untouched. An existing product that holds one of the keys
// but is not recognisably the import (see classifyProducts) is a conflict:
// it is reported and nothing is written. Writing requires a verified local target.
//
// Every imported product gets one variant with no size/colour:
//   slug  dummyjson-<id>-<title>   (Product.slug is unique)
//   sku   DUMMYJSON-<id>           (ProductVariant.sku is unique)
// The source id lives only in these keys; it is never used as a database id.
import os from "node:os";
import { pathToFileURL } from "node:url";

export const SOURCE_URL = "https://dummyjson.com/products?limit=0";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const IMAGE_HOST = "cdn.dummyjson.com";
const MAX_PRICE = 99_999_999.99; // Decimal(10, 2)

// DummyJSON categories whose name AND contents match an existing seeded
// category reuse it. Everything else gets its own top-level category.
// ("tops" is not mapped to women-tops: its products are dresses and frocks.)
export const CATEGORY_MAP = {
    "mens-shirts": "men-shirts",
    "mens-shoes": "men-shoes",
    "womens-dresses": "women-dresses",
    "womens-shoes": "women-shoes",
    "womens-bags": "accessories-bags",
    "sunglasses": "accessories-sunglasses",
};

// Same rule as prisma/seed.js and services/adminCatalogService.js.
export const slugify = (value) =>
    value.toLowerCase().replace(/&/g, "").replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// "home-decoration" -> "Home Decoration"
export const categoryName = (slug) => slug.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

export const skuFor = (sourceId) => `DUMMYJSON-${sourceId}`;
export const slugPrefixFor = (sourceId) => `dummyjson-${sourceId}-`;
export const slugFor = (product) => `${slugPrefixFor(product.id)}${slugify(product.title)}`.slice(0, 220).replace(/-$/, "");

// ---------------------------------------------------------------------------
// Source validation: the whole response is rejected on any problem, so a
// truncated or changed feed never produces a partial import.
// ---------------------------------------------------------------------------

const isText = (value, max) => typeof value === "string" && value.trim() !== "" && value.length <= max;

function isImageUrl(value) {
    if (!isText(value, 500)) return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === IMAGE_HOST;
    } catch {
        return false;
    }
}

function productErrors(product) {
    const errors = [];
    const fail = (field) => errors.push(`product ${product?.id ?? "?"}: invalid ${field}`);

    if (!Number.isInteger(product?.id) || product.id < 1) fail("id");
    if (!isText(product?.title, 200)) fail("title");
    if (product?.description != null && typeof product.description !== "string") fail("description");
    if (!isText(product?.category, 100) || slugify(product.category) !== product.category) fail("category");
    if (product?.brand != null && !isText(product.brand, 100)) fail("brand");
    if (typeof product?.price !== "number" || !Number.isFinite(product.price) || product.price <= 0 || product.price > MAX_PRICE
        || Math.round(product.price * 100) / 100 !== product.price) fail("price");
    if (!Number.isInteger(product?.stock) || product.stock < 0 || product.stock > 4_294_967_295) fail("stock");
    if (!Array.isArray(product?.images) || !product.images.length || !product.images.every(isImageUrl)) fail("images");

    return errors;
}

export function validateSource(body) {
    const errors = [];

    if (!body || typeof body !== "object" || !Array.isArray(body.products)) {
        return { errors: ["response has no products array"], products: [] };
    }

    const { products, total, skip, limit } = body;

    if (!Number.isInteger(total) || total < 1) errors.push(`invalid total: ${total}`);
    if (products.length !== total) errors.push(`returned ${products.length} products but total is ${total}`);
    if (skip !== 0) errors.push(`expected skip 0, got ${skip}`);
    if (limit !== products.length) errors.push(`limit ${limit} does not match ${products.length} returned products`);

    const ids = new Set();
    for (const product of products) {
        errors.push(...productErrors(product));
        if (ids.has(product?.id)) errors.push(`duplicate product id ${product.id}`);
        ids.add(product?.id);
    }

    return { errors, products };
}

// ---------------------------------------------------------------------------
// Mapping to the Prisma schema
// ---------------------------------------------------------------------------

export const categorySlugFor = (sourceCategory) => CATEGORY_MAP[sourceCategory] ?? sourceCategory;

// Fields for prisma.product.create, minus categoryId. The source list price is
// the price; its discountPercentage is not turned into an invented sale.
export function toProductData(product) {
    return {
        name: product.title.trim(),
        slug: slugFor(product),
        description: product.description?.trim() || null,
        brand: product.brand?.trim() || null,
        price: product.price.toFixed(2),
        originalPrice: null,
        isNew: false,
        isActive: true,
        images: {
            create: product.images.map((url, position) => ({ url, altText: product.title.trim().slice(0, 200), position })),
        },
        variants: {
            create: [{ sku: skuFor(product.id), size: null, color: null, colorHex: null, price: null, originalPrice: null, stock: product.stock, isActive: true }],
        },
    };
}

// ---------------------------------------------------------------------------
// Target verification
// ---------------------------------------------------------------------------

// Writing is allowed only when every check passes: development mode, a
// loopback DATABASE_URL host, and a MySQL server reporting this machine's
// hostname (a tunnel to a remote server also looks like 127.0.0.1).
export function targetProblems({ env = process.env, serverHostname, machineHostname = os.hostname() } = {}) {
    const problems = [];

    if (env.NODE_ENV !== "development") problems.push(`NODE_ENV is "${env.NODE_ENV ?? ""}", not "development"`);

    let host = null;
    try {
        host = new URL(env.DATABASE_URL).hostname;
    } catch {
        problems.push("DATABASE_URL is missing or not a URL");
    }
    if (host !== null && !LOCAL_HOSTS.has(host)) problems.push(`DATABASE_URL host "${host}" is not a loopback address`);

    if (!serverHostname) problems.push("could not read the database server's hostname");
    else if (serverHostname.toLowerCase() !== machineHostname.toLowerCase()) {
        problems.push(`database server hostname "${serverHostname}" is not this machine ("${machineHostname}")`);
    }

    return problems;
}

// ---------------------------------------------------------------------------
// Matching and planning (pure: no database access)
// ---------------------------------------------------------------------------

// `rows` are the existing products holding any import key, as
// { id, name, slug, skus: [every variant SKU] }. Keys compare case-insensitively,
// like the database's unique indexes do.
//
// A source product is already imported only when exactly one existing product
// holds its keys and that product is recognisably the import: it has BOTH
// keys, or it has one key (an admin edited the other) and still carries the
// source title. Any other holder is a conflict, which is reported, never skipped.
export function classifyProducts(products, rows) {
    const imported = [];
    const conflicts = [];
    const pending = [];

    for (const product of products) {
        const sku = skuFor(product.id);
        const prefix = slugPrefixFor(product.id);
        const bySku = rows.filter((row) => row.skus.some((value) => value.toUpperCase() === sku));
        const bySlug = rows.filter((row) => row.slug.toLowerCase().startsWith(prefix));
        const holders = [...new Map([...bySku, ...bySlug].map((row) => [row.id, row])).values()];

        if (!holders.length) {
            pending.push(product);
            continue;
        }

        const describe = holders.map((row) => `#${row.id} "${row.name}" (slug ${row.slug})`).join(", ");

        if (holders.length > 1) {
            conflicts.push({ product, note: `SKU ${sku} and slug prefix ${prefix} are held by different products: ${describe}` });
            continue;
        }

        const [row] = holders;
        const bothKeys = bySku.length === 1 && bySlug.length === 1;
        const sameTitle = row.name.trim() === product.title.trim();

        if (bothKeys || sameTitle) {
            imported.push({ product, productId: row.id });
        } else {
            const key = bySku.length ? `SKU ${sku}` : `slug prefix ${prefix}`;
            conflicts.push({ product, note: `${key} is held by unrelated product ${describe}` });
        }
    }

    return { imported, conflicts, pending };
}

// Existing categories are reused as they are (never updated). A new one is
// created only when its slug is free; a same-slug category with a different
// name is a conflict, so nothing is filed under an unrelated category.
// `existing`: [{ id, slug, name }] for (at least) the wanted slugs.
export function planCategories(products, existing) {
    const wanted = [...new Set(products.map((p) => p.category))];
    const bySlug = new Map(existing.map((c) => [c.slug, c]));

    return wanted.map((source) => {
        const slug = categorySlugFor(source);
        const found = bySlug.get(slug);
        const mapped = source in CATEGORY_MAP;

        if (found && !mapped && found.name.toLowerCase() !== categoryName(source).toLowerCase()) {
            return { source, slug, action: "conflict", note: `slug "${slug}" belongs to category "${found.name}"` };
        }
        if (mapped && !found) return { source, slug, action: "conflict", note: `mapped category "${slug}" does not exist` };

        return found ? { source, slug, action: "reuse", id: found.id } : { source, slug, action: "create", name: categoryName(source) };
    });
}

// The whole write plan. Any product or category conflict blocks every write.
export function buildPlan(products, { rows, categories }) {
    const { imported, conflicts, pending } = classifyProducts(products, rows);
    const categoryPlans = planCategories(pending, categories);
    const categoryConflicts = categoryPlans.filter((c) => c.action === "conflict");

    return {
        imported,
        conflicts,
        pending,
        categories: categoryPlans,
        categoryConflicts,
        canWrite: conflicts.length === 0 && categoryConflicts.length === 0,
    };
}

// An unexpected error once writes have begun. Rows created so far are kept
// (each product is atomic; nothing is rolled back, retried or resumed here),
// so say how far the run got and how to recover.
export function partialImportError(error, { products, categories }) {
    return new Error(
        `Import stopped by an unexpected error after writes began: ${error?.message ?? error}\n`
        + `The import may be partial: ${products} product(s) and ${categories} categor${categories === 1 ? "y" : "ies"} `
        + "were created in this run and are kept.\n"
        + "To recover, run the dry run (pnpm catalog:import-dummyjson) to review the current state, "
        + "then run it again with --write; already imported products are skipped.",
        { cause: error },
    );
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function fetchSource(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`GET ${url} -> HTTP ${response.status}`);
    return response.json();
}

// Read-only: the existing rows buildPlan needs.
async function loadExisting(prisma, products) {
    const skus = products.map((p) => skuFor(p.id));
    const categorySlugs = [...new Set(products.map((p) => categorySlugFor(p.category)))];
    const [holders, categories] = await Promise.all([
        prisma.product.findMany({
            where: { OR: [{ slug: { startsWith: "dummyjson-" } }, { variants: { some: { sku: { in: skus } } } }] },
            select: { id: true, name: true, slug: true, variants: { select: { sku: true } } },
        }),
        prisma.category.findMany({ where: { slug: { in: categorySlugs } }, select: { id: true, slug: true, name: true } }),
    ]);

    return {
        rows: holders.map(({ variants, ...row }) => ({ ...row, skus: variants.map((v) => v.sku) })),
        categories,
    };
}

async function counts(prisma) {
    const [products, variants, images, categories, orders, orderItems] = await Promise.all([
        prisma.product.count(), prisma.productVariant.count(), prisma.productImage.count(),
        prisma.category.count(), prisma.order.count(), prisma.orderItem.count(),
    ]);
    return { products, variants, images, categories, orders, orderItems };
}

export async function run({ write = false, url = SOURCE_URL, log = console.log } = {}) {
    const body = await fetchSource(url);
    const { errors, products } = validateSource(body);

    if (errors.length) {
        throw new Error(`Source validation failed (${errors.length}):\n  ${errors.slice(0, 20).join("\n  ")}`);
    }
    log(`Source OK: total ${body.total}, returned ${products.length}`);

    const { default: prisma } = await import("../config/db.js");

    try {
        const [{ hostname: serverHostname }] = await prisma.$queryRaw`SELECT @@hostname AS hostname`;
        const problems = targetProblems({ serverHostname });
        log(problems.length ? `Target NOT verified as local development:\n  ${problems.join("\n  ")}` : `Target verified: local development database (server ${serverHostname})`);

        const before = await counts(prisma);
        const plan = buildPlan(products, await loadExisting(prisma, products));
        const { imported, conflicts, pending, categories, categoryConflicts } = plan;

        log("Before:", before);
        log(`Products: ${products.length} in source, ${imported.length} already imported (skipped), `
            + `${conflicts.length} key conflicts, ${pending.length} to create`);
        for (const { note } of conflicts) log(`  Conflict: ${note}`);
        log("Categories:", categories.map((c) => `${c.source} -> ${c.slug} (${c.action}${c.note ? `: ${c.note}` : ""})`).join(", ") || "none needed");

        if (!plan.canWrite) {
            throw new Error(`${conflicts.length} product key conflict(s) and ${categoryConflicts.length} category conflict(s); `
                + "nothing written. Resolve them by hand; this script never changes existing products.");
        }
        if (!write) {
            log("Dry run: nothing written. Re-run with --write to import.");
            return { before, skipped: imported.length, toCreate: pending.length, created: 0, dryRun: true };
        }
        if (problems.length) throw new Error("Refusing to write: the database target is not verified as local development");

        const categoryIds = new Map(categories.filter((c) => c.id).map((c) => [c.source, c.id]));
        let createdCategories = 0;
        let created = 0;
        let raced = 0;

        try {
            for (const plan of categories.filter((c) => c.action === "create")) {
                const category = await prisma.category.create({ data: { name: plan.name, slug: plan.slug, parentId: null, isActive: true } });
                categoryIds.set(plan.source, category.id);
                createdCategories++;
            }

            // One product (with its variant and images) per create: each is
            // atomic. A unique-key clash is re-checked: skipped only if another
            // run created this same import, otherwise the run stops (products
            // created so far are kept; a re-run skips them).
            for (const product of pending) {
                try {
                    await prisma.product.create({ data: { ...toProductData(product), categoryId: categoryIds.get(product.category) } });
                    created++;
                } catch (error) {
                    if (error?.code !== "P2002") throw error;

                    const recheck = classifyProducts([product], (await loadExisting(prisma, [product])).rows);
                    if (!recheck.imported.length) {
                        const note = recheck.conflicts[0]?.note ?? `a unique key of DummyJSON product ${product.id} is already taken`;
                        throw Object.assign(new Error(`Stopped after ${created} new products: ${note}`), { keyConflict: true });
                    }
                    raced++;
                }
            }
        } catch (error) {
            if (error?.keyConflict) throw error;
            throw partialImportError(error, { products: created, categories: createdCategories });
        }

        const after = await counts(prisma);
        log(`Created ${created} products and ${createdCategories} categories; ${imported.length + raced} skipped as already imported`);
        log("After:", after);

        return { before, after, skipped: imported.length + raced, created, createdCategories, dryRun: false };
    } finally {
        await prisma.$disconnect();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await import("dotenv/config");
    run({ write: process.argv.includes("--write") }).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
