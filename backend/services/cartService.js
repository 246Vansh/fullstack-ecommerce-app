import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";

const itemSelect = {
    id: true,
    quantity: true,
    variant: {
        select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            colorHex: true,
            price: true,
            originalPrice: true,
            stock: true,
            isActive: true,
            product: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    brand: true,
                    price: true,
                    originalPrice: true,
                    isActive: true,
                    images: {
                        select: { url: true, altText: true },
                        orderBy: { position: "asc" },
                        take: 1,
                    },
                },
            },
        },
    },
};

const toMoney = (value) => (value == null ? null : new Prisma.Decimal(value).toDecimalPlaces(2).toNumber());

// Prices always come from the database: the variant price overrides the product price.
function toCartItem({ id, quantity, variant }) {
    const { product } = variant;
    const unitPrice = new Prisma.Decimal(variant.price ?? product.price);
    const originalPrice = variant.originalPrice ?? product.originalPrice;

    return {
        id,
        quantity,
        unitPrice: toMoney(unitPrice),
        originalPrice: toMoney(originalPrice),
        subtotal: toMoney(unitPrice.mul(quantity)),
        // False when the product was deactivated or stock dropped below the quantity.
        isAvailable: variant.isActive && product.isActive && quantity <= variant.stock,
        product: {
            id: product.id,
            name: product.name,
            slug: product.slug,
            brand: product.brand,
            image: product.images[0]?.url ?? null,
            alt: product.images[0]?.altText ?? product.name,
        },
        variant: {
            id: variant.id,
            sku: variant.sku,
            size: variant.size,
            color: variant.color,
            colorHex: variant.colorHex,
            stock: variant.stock,
        },
    };
}

// Creates the cart on first use. INSERT IGNORE makes concurrent first requests safe.
// Runs outside transactions: inside one, the re-read would use a stale snapshot.
async function getCartId(userId) {
    const where = { userId };
    const existing = await prisma.cart.findUnique({ where, select: { id: true } });

    if (existing) return existing.id;

    await prisma.cart.createMany({ data: [where], skipDuplicates: true });

    const cart = await prisma.cart.findUnique({ where, select: { id: true } });

    return cart.id;
}

export async function getCart(userId) {
    const cartId = await getCartId(userId);

    const items = await prisma.cartItem.findMany({
        where: { cartId },
        select: itemSelect,
        orderBy: { createdAt: "asc" },
    });

    const cartItems = items.map(toCartItem);

    const subtotal = items.reduce(
        (sum, { quantity, variant }) => sum.add(new Prisma.Decimal(variant.price ?? variant.product.price).mul(quantity)),
        new Prisma.Decimal(0),
    );

    return {
        id: cartId,
        items: cartItems,
        itemCount: cartItems.reduce((count, item) => count + item.quantity, 0),
        subtotal: toMoney(subtotal),
    };
}

function stockError(stock) {
    const message = stock > 0
        ? `Only ${stock} item${stock === 1 ? "" : "s"} available in stock`
        : "This item is out of stock";

    return new ApiError(409, message, [{ field: "quantity", message }]);
}

async function findPurchasableVariant(variantId) {
    const variant = await prisma.productVariant.findFirst({
        where: { id: variantId, isActive: true, product: { isActive: true } },
        select: { id: true, stock: true },
    });

    if (!variant) {
        throw new ApiError(404, "Product variant not found", [
            { field: "variantId", message: "Product variant not found" },
        ]);
    }

    return variant;
}

// Adds to the existing line when the variant is already in the cart.
export async function addItem(userId, { variantId, quantity }) {
    const variant = await findPurchasableVariant(variantId);
    const cartId = await getCartId(userId);

    await prisma.$transaction(async (tx) => {
        // Locks this user's cart row so concurrent adds (e.g. a double-click) run
        // one after another. updateMany is a bare UPDATE, so it takes the lock
        // before the read below and that read sees the previous add's result.
        await tx.cart.updateMany({ where: { id: cartId }, data: { updatedAt: new Date() } });

        const existing = await tx.cartItem.findUnique({
            where: { cartId_variantId: { cartId, variantId } },
            select: { id: true, quantity: true },
        });

        const newQuantity = (existing?.quantity ?? 0) + quantity;

        if (newQuantity > variant.stock) {
            throw stockError(variant.stock);
        }

        if (existing) {
            await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: newQuantity } });
        } else {
            await tx.cartItem.create({ data: { cartId, variantId, quantity } });
        }
    });

    return getCart(userId);
}

// Filtering by cart.userId means another user's item behaves as not found.
async function findOwnItem(userId, itemId) {
    const item = await prisma.cartItem.findFirst({
        where: { id: itemId, cart: { userId } },
        select: { id: true, variantId: true },
    });

    if (!item) {
        throw new ApiError(404, "Cart item not found");
    }

    return item;
}

export async function updateItem(userId, itemId, { quantity }) {
    const item = await findOwnItem(userId, itemId);
    const variant = await findPurchasableVariant(item.variantId);

    if (quantity > variant.stock) {
        throw stockError(variant.stock);
    }

    // Still scoped to the user, so an item deleted in the meantime is a 404, not a 500.
    const { count } = await prisma.cartItem.updateMany({
        where: { id: item.id, cart: { userId } },
        data: { quantity },
    });

    if (count === 0) {
        throw new ApiError(404, "Cart item not found");
    }

    return getCart(userId);
}

export async function removeItem(userId, itemId) {
    const { count } = await prisma.cartItem.deleteMany({
        where: { id: itemId, cart: { userId } },
    });

    if (count === 0) {
        throw new ApiError(404, "Cart item not found");
    }

    return getCart(userId);
}

export async function clearCart(userId) {
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });

    return getCart(userId);
}
