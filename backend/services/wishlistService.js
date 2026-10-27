import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { listSelect, toListItem } from "./productService.js";

/*
|--------------------------------------------------------------------------
| Wishlist
|--------------------------------------------------------------------------
| Every read and write is scoped by the signed-in user's id; there is no way
| to name another user's wishlist. Products are saved, not variants.
|
| Adding and removing are idempotent, so a double click or a retried request
| is harmless: the unique (userId, productId) key makes a repeated add a
| no-op, and removing something that is not there succeeds.
|
| Only active products are listed (as in the catalog). A row whose product
| is deactivated is kept and reappears if the product is reactivated; a
| deleted product takes its rows with it (ON DELETE CASCADE).
*/

// Keeps the list (which is not paginated) small enough to load in one request.
export const WISHLIST_LIMIT = 100;

const isDuplicate = (err) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
// The product was deleted between the existence check and the insert.
const isMissingProduct = (err) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";

// The catalog list item (GET /products), plus the variant id when the product
// has exactly one active variant, so it can be added to the cart from the
// wishlist without choosing a size or color.
const wishlistSelect = {
    createdAt: true,
    product: {
        select: {
            ...listSelect,
            variants: {
                where: { isActive: true },
                select: { id: true, size: true, color: true, colorHex: true, stock: true },
                orderBy: { id: "asc" },
            },
        },
    },
};

function toWishlistItem({ createdAt, product }) {
    const only = product.variants.length === 1 ? product.variants[0] : null;

    return {
        ...toListItem(product),
        addedAt: createdAt,
        variantId: only?.id ?? null,
        variantStock: only?.stock ?? null,
    };
}

// Newest first; id breaks ties between products saved in the same instant.
export async function listWishlist(userId) {
    const rows = await prisma.wishlistItem.findMany({
        where: { userId, product: { isActive: true } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: wishlistSelect,
    });

    return rows.map(toWishlistItem);
}

// -> { productId, added } where added is false when it was already saved.
export async function addToWishlist(userId, productId) {
    const product = await prisma.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true } });

    if (!product) {
        throw new ApiError(404, "Product not found");
    }

    const existing = await prisma.wishlistItem.findUnique({
        where: { userId_productId: { userId, productId } },
        select: { id: true },
    });

    if (existing) return { productId, added: false };

    // A soft cap: two simultaneous adds at the limit can both pass, by one.
    if (await prisma.wishlistItem.count({ where: { userId } }) >= WISHLIST_LIMIT) {
        throw new ApiError(409, `Your wishlist can hold up to ${WISHLIST_LIMIT} products. Remove one to add another.`);
    }

    try {
        await prisma.wishlistItem.create({ data: { userId, productId } });

        return { productId, added: true };
    } catch (err) {
        // A concurrent add of the same product won the race: already saved.
        if (isDuplicate(err)) return { productId, added: false };
        if (isMissingProduct(err)) throw new ApiError(404, "Product not found");
        throw err;
    }
}

// -> { productId, removed } where removed is false when it was not saved.
export async function removeFromWishlist(userId, productId) {
    const { count } = await prisma.wishlistItem.deleteMany({ where: { userId, productId } });

    return { productId, removed: count > 0 };
}
