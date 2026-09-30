import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";

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

const listSelect = {
    id: true,
    name: true,
    slug: true,
    brand: true,
    price: true,
    originalPrice: true,
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

function toListItem(product) {
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

// Builds the Prisma `where` from already-validated query filters.
function buildWhere(filters) {
    const where = { isActive: true };
    const and = [];

    if (filters.search) {
        and.push({
            OR: [
                { name: { contains: filters.search } },
                { brand: { contains: filters.search } },
                { description: { contains: filters.search } },
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

export async function listProducts(filters) {
    const where = buildWhere(filters);
    const { page, limit } = filters;

    const [total, products] = await prisma.$transaction([
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

export async function getProductById(id) {
    const product = await prisma.product.findFirst({
        where: { id, isActive: true },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            brand: true,
            price: true,
            originalPrice: true,
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
        },
    });

    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    return {
        ...product,
        price: toNumber(product.price),
        originalPrice: toNumber(product.originalPrice),
        image: product.images[0]?.url ?? null,
        inStock: product.variants.some((variant) => variant.stock > 0),
        variants: product.variants.map((variant) => ({
            ...variant,
            price: toNumber(variant.price ?? product.price),
            originalPrice: toNumber(variant.originalPrice ?? product.originalPrice),
        })),
    };
}
