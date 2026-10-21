import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { escapeLike } from "./productService.js";
import { roundMoney, toMoney, unitPriceOf, originalPriceOf } from "./pricingService.js";

/*
|--------------------------------------------------------------------------
| Admin catalog management
|--------------------------------------------------------------------------
| Callers pass express-validator output; every write still copies only the
| fields listed here, so ids, timestamps or unknown keys in a body are never
| written. Rules the schema cannot express are enforced below:
|
| - Products and variants are never deleted, only deactivated. Order items
|   keep their snapshot either way, and carts/checkout/order creation already
|   refuse inactive products and variants, so deactivation is the safe "remove".
| - Stock is never negative. `stock` sets an absolute count; `stockAdjustment`
|   is applied with a conditional UPDATE, like order placement, so it cannot
|   lose a concurrent order's decrement or go below zero.
| - A "was" price (originalPrice) must be above the price it is shown next to,
|   for the product and for every variant's effective pair (pricingService's
|   unitPriceOf/originalPriceOf), so a product price change is refused if it
|   would break a variant that inherits from it.
| - Categories stay two levels deep (the storefront assumes top-level + sub),
|   and one cannot be deactivated while it still has active products or
|   active subcategories, which would leave them listed under a hidden category.
|
| Concurrency: the rules above span several rows, so check-then-write runs in
| a transaction that first takes a row lock (InnoDB, REPEATABLE READ):
| - Product row FOR UPDATE: every price change, every variant write and
|   gallery replacement for that product. Writers queue, so two admins cannot
|   each pass the check against the other's old data.
| - Category row FOR UPDATE to deactivate it; FOR SHARE (in the same
|   transaction as the write) to put an active product or subcategory in it.
| The first lock is the first statement, so the transaction's snapshot is
| taken after it and sees everything the previous lock holder committed.
|
| Lock order, everywhere: variant -> product -> category (subcategory before
| parent). Order placement already locks variant -> product (stock decrement,
| then order items share-lock the product through their foreign key). What
| the order cannot prevent (two admins cross-moving categories) is a deadlock
| MySQL resolves by rolling one back; rethrow() turns that into a 409.
*/

export const ADMIN_PAGINATION = { defaultLimit: 20, maxLimit: 100 };

// Sanity cap on a single variant's stock; far below the column limit, high
// enough for any real count, and it catches typos like an extra few zeros.
export const MAX_STOCK = 1_000_000;

// `currency` is deliberately not here: it is written by createProduct only.
const PRODUCT_FIELDS = ["name", "slug", "description", "brand", "price", "originalPrice", "isNew", "isActive", "categoryId"];
const VARIANT_FIELDS = ["sku", "size", "color", "colorHex", "price", "originalPrice", "stock", "isActive"];
const IMAGE_FIELDS = ["url", "altText"];
const CATEGORY_FIELDS = ["name", "slug", "description", "image", "parentId", "isActive"];

const pick = (source, fields) => Object.fromEntries(
    fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]),
);

// Same rule as prisma/seed.js, so generated slugs match the seeded ones.
export const slugify = (value) =>
    value.toLowerCase().replace(/&/g, "").replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const toNumber = (value) => (value == null ? null : Number(value));

const notFound = (what) => new ApiError(404, `${what} not found`);

const conflict = (message, field) => new ApiError(409, message, field ? [{ field, message }] : undefined);

// MySQL deadlock (1213) and lock wait timeout (1205). Raised by a raw locking
// read, Prisma reports them as P2010 (raw query failed), not P2034.
const isRawLockFailure = (err) => err.code === "P2010"
    && ["1213", "1205"].includes(err.meta?.driverAdapterError?.cause?.originalCode);

// A unique-constraint race (two admins saving the same slug/SKU at once) is
// reported like the pre-checks would have; anything else stays a 500.
function rethrow(err, fallbackMessage) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") throw conflict(fallbackMessage);
        if (err.code === "P2025") throw notFound("Record");
        if (err.code === "P2003") throw conflict("A related record is missing or still in use");
        // Lock wait timeout / deadlock / transaction timeout: nothing was written.
        if (["P2028", "P2034"].includes(err.code) || isRawLockFailure(err)) {
            throw conflict("The catalog changed while saving; please try again");
        }
    }

    throw err;
}

// ------------------------------------------------------------ row locks

// Returns false when the row does not exist. Only usable inside a transaction.
async function lockProduct(tx, id) {
    const rows = await tx.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;

    return rows.length > 0;
}

// Returns the variant's productId, or null when it does not exist.
async function lockVariant(tx, id) {
    const rows = await tx.$queryRaw`SELECT productId FROM product_variants WHERE id = ${id} FOR UPDATE`;

    return rows.length ? Number(rows[0].productId) : null;
}

// A locking read returns the latest committed row, whatever the snapshot.
async function lockCategory(tx, id, mode) {
    const rows = mode === "update"
        ? await tx.$queryRaw`SELECT parentId, isActive FROM categories WHERE id = ${id} FOR UPDATE`
        : await tx.$queryRaw`SELECT parentId, isActive FROM categories WHERE id = ${id} FOR SHARE`;

    if (!rows.length) return null;

    return { parentId: rows[0].parentId == null ? null : Number(rows[0].parentId), isActive: Boolean(Number(rows[0].isActive)) };
}

// ------------------------------------------------------------ price rules

// "Was" prices must be strictly above the price they are shown next to.
function assertOriginalAbove(price, originalPrice, field) {
    if (originalPrice != null && !roundMoney(originalPrice).greaterThan(roundMoney(price))) {
        throw new ApiError(422, "Validation failed", [{ field, message: "originalPrice must be greater than the price" }]);
    }
}

// The pair a variant is shown and charged with, after inheriting from its
// product: the same rule the storefront, cart and checkout use.
const variantPairIsValid = (variant, product) => {
    const originalPrice = originalPriceOf(variant, product);

    return originalPrice == null || originalPrice.greaterThan(unitPriceOf(variant, product));
};

// ------------------------------------------------------------ read shapes

const categorySelect = { id: true, name: true, slug: true, isActive: true };

const adminProductSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    brand: true,
    price: true,
    originalPrice: true,
    currency: true,
    isNew: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    category: { select: { ...categorySelect, parent: { select: categorySelect } } },
    images: { select: { id: true, url: true, altText: true, position: true }, orderBy: { position: "asc" } },
    // All variants, inactive included, so they can be reactivated.
    variants: {
        select: {
            id: true, sku: true, size: true, color: true, colorHex: true,
            price: true, originalPrice: true, stock: true, isActive: true,
        },
        orderBy: { id: "asc" },
    },
    _count: { select: { orderItems: true } },
};

function toAdminVariant(variant, product) {
    return {
        ...variant,
        price: toNumber(variant.price),
        originalPrice: toNumber(variant.originalPrice),
        // What the cart and checkout will charge (variant price, else product price).
        effectivePrice: toMoney(unitPriceOf(variant, product)),
    };
}

function toAdminProduct({ _count, ...product }) {
    return {
        ...product,
        price: toNumber(product.price),
        originalPrice: toNumber(product.originalPrice),
        orderItemCount: _count.orderItems,
        variants: product.variants.map((variant) => toAdminVariant(variant, product)),
    };
}

async function loadProduct(id, client = prisma) {
    const product = await client.product.findUnique({ where: { id }, select: adminProductSelect });

    if (!product) throw notFound("Product");

    return toAdminProduct(product);
}

// ------------------------------------------------------------ shared checks

// Share-locks the category until the caller's transaction commits, so a
// concurrent deactivation waits and then sees the product this one writes.
async function assertActiveCategory(tx, categoryId) {
    const category = await lockCategory(tx, categoryId, "share");

    if (!category) {
        throw new ApiError(422, "Validation failed", [{ field: "categoryId", message: "Category not found" }]);
    }

    if (!category.isActive) {
        throw conflict("Products cannot be placed in an inactive category", "categoryId");
    }
}

async function assertProductSlugFree(tx, slug, exceptId) {
    const existing = await tx.product.findUnique({ where: { slug }, select: { id: true } });

    if (existing && existing.id !== exceptId) {
        throw conflict("A product with this slug already exists", "slug");
    }
}

async function assertSkusFree(tx, skus, exceptVariantId) {
    const existing = await tx.productVariant.findMany({ where: { sku: { in: skus } }, select: { id: true, sku: true } });
    const taken = existing.filter((variant) => variant.id !== exceptVariantId);

    if (taken.length) {
        throw conflict(`SKU already in use: ${taken.map((variant) => variant.sku).join(", ")}`, "sku");
    }
}

// The (productId, size, color) unique key does not stop duplicates when size
// or color is NULL (MySQL treats NULLs as distinct), so it is checked here.
// Callers hold the product lock, which serializes every variant write for the
// product; without it two requests could both pass this check.
async function assertOptionFree(tx, productId, { size, color }, exceptVariantId) {
    const existing = await tx.productVariant.findFirst({
        where: { productId, size: size ?? null, color: color ?? null, ...(exceptVariantId && { id: { not: exceptVariantId } }) },
        select: { id: true },
    });

    if (existing) {
        throw conflict("This product already has a variant with the same size and color", "variant");
    }
}

const pairError = (field) => new ApiError(422, "Validation failed", [{
    field,
    message: "originalPrice (own or inherited from the product) must be greater than the variant's price",
}]);

const optionKey = (variant) => JSON.stringify([variant.size ?? null, variant.color ?? null]);

// ------------------------------------------------------------ products

export async function listAdminProducts({ page, limit, search, isActive, categoryId }) {
    const where = {
        ...(isActive !== undefined && { isActive }),
        ...(categoryId && { OR: [{ categoryId }, { category: { parentId: categoryId } }] }),
        ...(search && {
            AND: [{
                OR: [
                    { name: { contains: escapeLike(search) } },
                    { brand: { contains: escapeLike(search) } },
                    { slug: { contains: escapeLike(search) } },
                    { variants: { some: { sku: { contains: escapeLike(search) } } } },
                ],
            }],
        }),
    };

    const [total, products] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
            where,
            select: {
                id: true, name: true, slug: true, brand: true, price: true, originalPrice: true, currency: true,
                isNew: true, isActive: true, createdAt: true, updatedAt: true,
                category: { select: categorySelect },
                images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
                variants: { select: { stock: true, isActive: true } },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);

    return {
        data: products.map(({ images, variants, ...product }) => ({
            ...product,
            price: toNumber(product.price),
            originalPrice: toNumber(product.originalPrice),
            image: images[0]?.url ?? null,
            variantCount: variants.length,
            activeVariantCount: variants.filter((variant) => variant.isActive).length,
            totalStock: variants.filter((variant) => variant.isActive).reduce((sum, variant) => sum + variant.stock, 0),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

export const getAdminProduct = (id) => loadProduct(id);

export async function createProduct(input) {
    // The currency is fixed from here on (USD when not given; see adminRoutes).
    const data = { ...pick(input, PRODUCT_FIELDS), ...pick(input, ["currency"]) };
    const variants = input.variants.map((variant) => pick(variant, VARIANT_FIELDS));
    const images = (input.images ?? []).map((image, position) => ({ ...pick(image, IMAGE_FIELDS), position }));

    data.slug ??= slugify([data.brand, data.name].filter(Boolean).join(" "));

    if (!data.slug) {
        throw new ApiError(422, "Validation failed", [{ field: "slug", message: "A slug could not be generated from the name; provide one" }]);
    }

    assertOriginalAbove(data.price, data.originalPrice, "originalPrice");

    variants.forEach((variant, index) => {
        if (!variantPairIsValid(variant, data)) {
            throw pairError(`variants[${index}].originalPrice`);
        }
    });

    const skus = variants.map((variant) => variant.sku);

    if (new Set(skus).size !== skus.length) {
        throw conflict("Each variant needs its own SKU", "sku");
    }

    if (new Set(variants.map(optionKey)).size !== variants.length) {
        throw conflict("Two variants have the same size and color", "variant");
    }

    try {
        const product = await prisma.$transaction(async (tx) => {
            await assertActiveCategory(tx, data.categoryId);
            await assertProductSlugFree(tx, data.slug);
            await assertSkusFree(tx, skus);

            return tx.product.create({
                data: { ...data, variants: { create: variants }, images: { create: images } },
                select: { id: true },
            });
        });

        return loadProduct(product.id);
    } catch (err) {
        rethrow(err, "A product slug or variant SKU is already in use");
    }
}

export async function updateProduct(id, input) {
    const data = pick(input, PRODUCT_FIELDS);

    try {
        await prisma.$transaction(async (tx) => {
            if (!(await lockProduct(tx, id))) throw notFound("Product");

            const current = await tx.product.findUnique({
                where: { id },
                select: {
                    price: true, originalPrice: true, isActive: true, categoryId: true,
                    variants: { select: { id: true, sku: true, price: true, originalPrice: true }, orderBy: { id: "asc" } },
                },
            });

            if (data.price !== undefined || data.originalPrice !== undefined) {
                const next = {
                    price: data.price ?? current.price,
                    originalPrice: data.originalPrice !== undefined ? data.originalPrice : current.originalPrice,
                };

                assertOriginalAbove(next.price, next.originalPrice, "originalPrice");

                // Variants that inherit the price or was-price must stay valid too
                // (inactive ones included, so reactivating one never needs a check).
                const broken = current.variants.filter((variant) => !variantPairIsValid(variant, next));

                if (broken.length) {
                    throw new ApiError(409, "This price change would leave variants with a was-price that is not above their price",
                        broken.map((variant) => ({
                            field: `variants[${variant.id}].originalPrice`,
                            message: `${variant.sku}: update or clear this variant's prices first`,
                        })));
                }
            }

            // Moving a product, or bringing one back, needs an active category.
            const willBeActive = data.isActive ?? current.isActive;
            const categoryId = data.categoryId ?? current.categoryId;
            const moving = categoryId !== current.categoryId;

            if (moving || (willBeActive && !current.isActive)) {
                await assertActiveCategory(tx, categoryId);
            }

            if (data.slug !== undefined) {
                await assertProductSlugFree(tx, data.slug, id);
            }

            await tx.product.update({ where: { id }, data, select: { id: true } });
        });
    } catch (err) {
        rethrow(err, "A product with this slug already exists");
    }

    return loadProduct(id);
}

// Soft delete: order history, cart rows and variants stay intact, the
// product just leaves the storefront. PATCH { isActive: true } restores it.
export async function deactivateProduct(id) {
    const { count } = await prisma.product.updateMany({ where: { id }, data: { isActive: false } });

    if (count === 0) throw notFound("Product");

    return loadProduct(id);
}

// Replaces the whole gallery; array order becomes display order (the first
// image is the product's main image). Order items keep their own image copy.
export async function replaceProductImages(id, input) {
    const images = input.map((image, position) => ({ ...pick(image, IMAGE_FIELDS), productId: id, position }));

    // Product lock: concurrent replacements queue, so the result is exactly one
    // request's gallery (their delete/insert gap locks would otherwise deadlock).
    try {
        await prisma.$transaction(async (tx) => {
            if (!(await lockProduct(tx, id))) throw notFound("Product");

            await tx.productImage.deleteMany({ where: { productId: id } });

            if (images.length) {
                await tx.productImage.createMany({ data: images });
            }
        });
    } catch (err) {
        rethrow(err, "The gallery could not be saved");
    }

    return loadProduct(id);
}

// ------------------------------------------------------------ variants

// Variant writes hold the product lock: it serializes the size/color check
// (which the NULL-tolerant unique key cannot enforce) and the price check
// against concurrent product price changes.
export async function createVariant(productId, input) {
    const data = pick(input, VARIANT_FIELDS);

    try {
        await prisma.$transaction(async (tx) => {
            if (!(await lockProduct(tx, productId))) throw notFound("Product");

            const product = await tx.product.findUnique({ where: { id: productId }, select: { price: true, originalPrice: true } });

            if (!variantPairIsValid(data, product)) {
                throw pairError("originalPrice");
            }

            await assertSkusFree(tx, [data.sku]);
            await assertOptionFree(tx, productId, data);

            await tx.productVariant.create({ data: { ...data, productId }, select: { id: true } });
        });
    } catch (err) {
        rethrow(err, "This SKU or size/color combination is already in use");
    }

    return loadProduct(productId);
}

export async function updateVariant(variantId, input) {
    const data = pick(input, VARIANT_FIELDS);
    const { stockAdjustment } = input;
    let productId;

    try {
        await prisma.$transaction(async (tx) => {
            // Variant before product: the same order as order placement (stock
            // decrement, then order items share-lock the product), so an admin
            // edit and a checkout of the same variant queue instead of deadlocking.
            productId = await lockVariant(tx, variantId);

            if (!productId) throw notFound("Variant");

            await lockProduct(tx, productId);

            const current = await tx.productVariant.findUnique({
                where: { id: variantId },
                select: {
                    size: true, color: true, price: true, originalPrice: true,
                    product: { select: { price: true, originalPrice: true } },
                },
            });

            if (data.price !== undefined || data.originalPrice !== undefined) {
                const next = {
                    price: data.price !== undefined ? data.price : current.price,
                    originalPrice: data.originalPrice !== undefined ? data.originalPrice : current.originalPrice,
                };

                if (!variantPairIsValid(next, current.product)) {
                    throw pairError("originalPrice");
                }
            }

            if (data.sku !== undefined) {
                await assertSkusFree(tx, [data.sku], variantId);
            }

            if (data.size !== undefined || data.color !== undefined) {
                await assertOptionFree(tx, productId, {
                    size: data.size !== undefined ? data.size : current.size,
                    color: data.color !== undefined ? data.color : current.color,
                }, variantId);
            }

            if (Object.keys(data).length) {
                await tx.productVariant.update({ where: { id: variantId }, data, select: { id: true } });
            }

            if (stockAdjustment) {
                await adjustStock(tx, variantId, stockAdjustment);
            }
        });
    } catch (err) {
        rethrow(err, "This SKU or size/color combination is already in use");
    }

    return loadProduct(productId);
}

// A relative change applied in the database, like order placement's
// decrement: the condition is re-checked on the latest committed row, so a
// concurrent order is never overwritten and stock never leaves [0, MAX_STOCK].
async function adjustStock(tx, variantId, delta) {
    const bound = delta < 0 ? { gte: -delta } : { lte: MAX_STOCK - delta };

    const { count } = await tx.productVariant.updateMany({
        where: { id: variantId, stock: bound },
        data: { stock: { increment: delta } },
    });

    if (count === 0) {
        const { stock } = await tx.productVariant.findUnique({ where: { id: variantId }, select: { stock: true } });

        throw conflict(delta < 0
            ? `Cannot remove ${-delta} units; only ${stock} in stock`
            : `Stock cannot exceed ${MAX_STOCK}`, "stockAdjustment");
    }
}

// Soft delete: carts show the item as unavailable and checkout refuses it,
// exactly as when stock runs out; order history keeps its snapshot.
export async function deactivateVariant(variantId) {
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, select: { productId: true } });

    if (!variant) throw notFound("Variant");

    await prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false }, select: { id: true } });

    return loadProduct(variant.productId);
}

// ------------------------------------------------------------ categories

const adminCategorySelect = {
    id: true, parentId: true, name: true, slug: true, description: true, image: true,
    isActive: true, createdAt: true, updatedAt: true,
    _count: { select: { products: true, children: true } },
};

const toAdminCategory = ({ _count, ...category }) => ({
    ...category,
    productCount: _count.products,
    childCount: _count.children,
});

// Flat list, inactive included; parentId gives the tree.
export async function listAdminCategories() {
    const categories = await prisma.category.findMany({
        select: adminCategorySelect,
        orderBy: [{ parentId: "asc" }, { name: "asc" }],
    });

    return categories.map(toAdminCategory);
}

// An active subcategory under an inactive parent would undo the
// deactivation rule above, so the parent must be active too. The parent is
// share-locked until the caller commits, so it cannot be deactivated, or
// turned into a subcategory, in between.
async function assertValidParent(tx, parentId, { selfId, willBeActive }) {
    if (parentId === selfId) {
        throw new ApiError(422, "Validation failed", [{ field: "parentId", message: "A category cannot be its own parent" }]);
    }

    const parent = await lockCategory(tx, parentId, "share");

    if (!parent) {
        throw new ApiError(422, "Validation failed", [{ field: "parentId", message: "Parent category not found" }]);
    }

    if (parent.parentId !== null) {
        throw new ApiError(422, "Validation failed", [{ field: "parentId", message: "Subcategories cannot have subcategories" }]);
    }

    if (willBeActive && !parent.isActive) {
        throw conflict("An active subcategory cannot belong to an inactive category", "parentId");
    }
}

async function assertCategorySlugFree(tx, slug, exceptId) {
    const existing = await tx.category.findUnique({ where: { slug }, select: { id: true } });

    if (existing && existing.id !== exceptId) {
        throw conflict("A category with this slug already exists", "slug");
    }
}

export async function createCategory(input) {
    const data = pick(input, CATEGORY_FIELDS);

    data.slug ??= slugify(data.name);

    if (!data.slug) {
        throw new ApiError(422, "Validation failed", [{ field: "slug", message: "A slug could not be generated from the name; provide one" }]);
    }

    try {
        const category = await prisma.$transaction(async (tx) => {
            if (data.parentId != null) {
                await assertValidParent(tx, data.parentId, { willBeActive: data.isActive !== false });
            }

            await assertCategorySlugFree(tx, data.slug);

            return tx.category.create({ data, select: adminCategorySelect });
        });

        return toAdminCategory(category);
    } catch (err) {
        rethrow(err, "A category with this slug already exists");
    }
}

export async function updateCategory(id, input) {
    const data = pick(input, CATEGORY_FIELDS);

    try {
        const category = await prisma.$transaction(async (tx) => {
            // Exclusive lock first: product and subcategory writes that need this
            // category active hold a share lock, so the counts below see them.
            if (!(await lockCategory(tx, id, "update"))) throw notFound("Category");

            const current = await tx.category.findUnique({
                where: { id },
                select: {
                    parentId: true,
                    isActive: true,
                    _count: {
                        select: {
                            products: { where: { isActive: true } },
                            children: true,
                        },
                    },
                },
            });

            const parentId = data.parentId !== undefined ? data.parentId : current.parentId;
            const willBeActive = data.isActive ?? current.isActive;
            const parentChanged = data.parentId !== undefined && data.parentId !== current.parentId;

            if (parentId != null && (parentChanged || (willBeActive && !current.isActive))) {
                await assertValidParent(tx, parentId, { selfId: id, willBeActive });
            }

            if (parentChanged && parentId != null && current._count.children > 0) {
                throw conflict("A category with subcategories cannot become a subcategory", "parentId");
            }

            if (data.isActive === false && current.isActive) {
                const activeChildren = await tx.category.count({ where: { parentId: id, isActive: true } });

                if (current._count.products > 0 || activeChildren > 0) {
                    throw conflict("Deactivate or move this category's active products and subcategories first", "isActive");
                }
            }

            if (data.slug !== undefined) {
                await assertCategorySlugFree(tx, data.slug, id);
            }

            return tx.category.update({ where: { id }, data, select: adminCategorySelect });
        });

        return toAdminCategory(category);
    } catch (err) {
        rethrow(err, "A category with this slug already exists");
    }
}
