import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { toMoney, unitPriceOf, originalPriceOf } from "./pricingService.js";

export const PAGINATION = {
    defaultLimit: 12,
    maxLimit: 48,
};

// Sort values match frontend/src/constants/catalog/sortOptions.js.
// There is no review data yet, so "rating-desc" falls back to newest.
const SORT_ORDERS = {
    "newest": [{ createdAt: "desc" }],
    "latest": [{ createdAt: "desc" }],
    "price-asc": [{ price: "asc" }],
    "price-desc": [{ price: "desc" }],
    "best-selling": [{ orderItems: { _count: "desc" } }],
    "rating-desc": [{ createdAt: "desc" }],
};

export const SORT_VALUES = Object.keys(SORT_ORDERS);

const categorySelect = { id: true, name: true, slug: true };

export const listSelect = {
    id: true,
    name: true,
    slug: true,
    brand: true,
    price: true,
    originalPrice: true,
    currency: true,
    isNew: true,
    createdAt: true,
    category: { select: categorySelect },
    images: {
        select: { url: true, altText: true },
        orderBy: { position: "asc" },
        take: 1,
    },
    variants: {
        where: { isActive: true },
        select: { size: true, color: true, colorHex: true, stock: true },
    },
};

const toNumber = (value) => (value == null ? null : Number(value));

const unique = (values) => [...new Set(values.filter(Boolean))];

export function toListItem(product) {
    const { images, variants, ...rest } = product;

    return {
        ...rest,
        price: toNumber(product.price),
        originalPrice: toNumber(product.originalPrice),
        image: images[0]?.url ?? null,
        alt: images[0]?.altText ?? product.name,
        colors: unique(variants.map((variant) => variant.color)),
        sizes: unique(variants.map((variant) => variant.size)),
        inStock: variants.some((variant) => variant.stock > 0),
    };
}

// Prisma sends `contains` as LIKE '%value%' without escaping the value, so a
// search for "%" or "_" would match everything. MySQL/MariaDB's default LIKE
// escape character is "\", so escaping it and both wildcards makes the search
// literal; the value is still sent as a bound parameter.
export const escapeLike = (value) => value.replace(/[\\%_]/g, "\\$&");

// Builds the Prisma `where` from already-validated query filters.
function buildWhere(filters) {
    const where = { isActive: true };
    const and = [];

    if (filters.search) {
        const search = escapeLike(filters.search);

        and.push({
            OR: [
                { name: { contains: search } },
                { brand: { contains: search } },
                { description: { contains: search } },
            ],
        });
    }

    // A top-level category also matches products in its subcategories.
    if (filters.category.length) {
        and.push({
            category: {
                OR: [
                    { slug: { in: filters.category } },
                    { parent: { slug: { in: filters.category } } },
                ],
            },
        });
    }

    if (filters.subcategory.length) {
        and.push({ category: { slug: { in: filters.subcategory }, parentId: { not: null } } });
    }

    if (filters.brand.length) {
        and.push({ brand: { in: filters.brand } });
    }

    if (filters.minPrice != null || filters.maxPrice != null) {
        and.push({
            price: {
                ...(filters.minPrice != null && { gte: filters.minPrice }),
                ...(filters.maxPrice != null && { lte: filters.maxPrice }),
            },
        });
    }

    // Color, size and stock must all match on the same variant.
    const variantMatch = { isActive: true };

    if (filters.color.length) variantMatch.color = { in: filters.color };
    if (filters.size.length) variantMatch.size = { in: filters.size };
    if (filters.inStock === true) variantMatch.stock = { gt: 0 };

    if (Object.keys(variantMatch).length > 1) {
        and.push({ variants: { some: variantMatch } });
    }

    if (filters.inStock === false) {
        and.push({ variants: { none: { isActive: true, stock: { gt: 0 } } } });
    }

    if (and.length) {
        where.AND = and;
    }

    return where;
}

// URL slug for a brand: the same rule as adminCatalogService.slugify and the
// seed, so "Levi's" -> "levis" and "H&M" -> "hm" match the existing links.
export const brandSlug = (name) => {
    const trimmed = name.trim();
    const slug = trimmed.toLowerCase().replace(/&/g, "").replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    // A name of symbols only ("&&") still gets a usable slug.
    return slug || trimmed.toLowerCase().replace(/\s+/g, "-");
};

// [{ brand, _count: { _all } }] from groupBy -> sorted brand options.
// Null, empty and whitespace-only brands are dropped. Names that share a slug
// ("H&M" / "HM") become one option; `names` holds every stored spelling, which
// the catalog sends as ?brand= so each of them still matches exactly.
export function toBrandOptions(groups) {
    const bySlug = new Map();

    for (const { brand, _count: { _all: count } } of groups) {
        if (typeof brand !== "string" || !brand.trim()) continue;

        const slug = brandSlug(brand);
        const option = bySlug.get(slug) ?? { slug, name: brand.trim(), names: [], productCount: 0, top: 0 };

        option.names.push(brand);
        option.productCount += count;
        if (count > option.top) Object.assign(option, { name: brand.trim(), top: count });

        bySlug.set(slug, option);
    }

    return [...bySlug.values()]
        .map(({ top, ...option }) => option)
        .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

// Brands of the products the catalog can show, with how many each has.
export async function listBrands() {
    const groups = await prisma.product.groupBy({
        by: ["brand"],
        where: { isActive: true, brand: { not: null } },
        _count: { _all: true },
    });

    return toBrandOptions(groups);
}

export async function listProducts(filters) {
    const where = buildWhere(filters);
    const { page, limit } = filters;

    // Independent reads: run them side by side instead of in one transaction,
    // which holds a single pooled connection for both.
    const [total, products] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
            where,
            select: listSelect,
            orderBy: [...SORT_ORDERS[filters.sort], { id: "desc" }],
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);

    return {
        data: products.map(toListItem),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

const detailSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    brand: true,
    price: true,
    originalPrice: true,
    currency: true,
    isNew: true,
    createdAt: true,
    category: {
        select: {
            ...categorySelect,
            parent: { select: categorySelect },
        },
    },
    images: {
        select: { id: true, url: true, altText: true, position: true },
        orderBy: { position: "asc" },
    },
    variants: {
        where: { isActive: true },
        select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            colorHex: true,
            price: true,
            originalPrice: true,
            stock: true,
        },
        orderBy: { id: "asc" },
    },
};

export async function getProductById(id) {
    const product = await prisma.product.findFirst({
        where: { id, isActive: true },
        select: detailSelect,
    });

    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    return toDetail(product);
}

// Several products in the GET /products/:id shape, in one query (the guest
// cart uses it). Missing and inactive ids are left out, as /:id would 404.
export async function getProductsByIds(ids) {
    const products = await prisma.product.findMany({
        where: { id: { in: ids }, isActive: true },
        select: detailSelect,
        orderBy: { id: "asc" },
    });

    return products.map(toDetail);
}

function toDetail(product) {
    return {
        ...product,
        price: toNumber(product.price),
        originalPrice: toNumber(product.originalPrice),
        image: product.images[0]?.url ?? null,
        inStock: product.variants.some((variant) => variant.stock > 0),
        variants: product.variants.map((variant) => ({
            ...variant,
            // The price the cart, checkout and order will charge for this variant.
            price: toMoney(unitPriceOf(variant, product)),
            originalPrice: toNumber(originalPriceOf(variant, product)),
        })),
    };
}
