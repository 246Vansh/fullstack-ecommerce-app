import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { listAddresses } from "./addressService.js";
import { calculateTotals, toMoney } from "./pricingService.js";

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

// Reasons an item blocks checkout. The cart is never changed here; the
// user decides whether to remove the item or lower the quantity.
function findIssue({ quantity, variant }) {
    if (!(quantity > 0)) {
        return { code: "INVALID_QUANTITY", message: "This item has an invalid quantity" };
    }

    if (!variant.product.isActive) {
        return { code: "PRODUCT_UNAVAILABLE", message: "This product is no longer available" };
    }

    if (!variant.isActive) {
        return { code: "VARIANT_UNAVAILABLE", message: "This option is no longer available" };
    }

    if (variant.stock === 0) {
        return { code: "OUT_OF_STOCK", message: "This item is out of stock" };
    }

    if (quantity > variant.stock) {
        return {
            code: "INSUFFICIENT_STOCK",
            message: `Only ${variant.stock} item${variant.stock === 1 ? "" : "s"} available in stock`,
        };
    }

    return null;
}

// Prices always come from the database: the variant price overrides the product price.
function toCheckoutItem(row) {
    const { id, quantity, variant } = row;
    const { product } = variant;
    const unitPrice = new Prisma.Decimal(variant.price ?? product.price);
    const originalPrice = variant.originalPrice ?? product.originalPrice;
    const issue = findIssue(row);

    return {
        id,
        quantity,
        unitPrice,
        item: {
            id,
            quantity,
            unitPrice: toMoney(unitPrice),
            originalPrice: originalPrice == null ? null : toMoney(originalPrice),
            subtotal: toMoney(unitPrice.mul(quantity)),
            isAvailable: !issue,
            issue,
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
        },
    };
}

// Loads and prices the user's cart from the database, flagging items that
// cannot be bought. `client` is prisma or a transaction (order creation).
// Returns { priced: [{ id, quantity, unitPrice: Decimal, item }], issues }.
export async function loadCartItems(client, userId) {
    const rows = await client.cartItem.findMany({
        where: { cart: { userId } },
        select: itemSelect,
        orderBy: { createdAt: "asc" },
    });

    const priced = rows.map(toCheckoutItem);

    const issues = priced
        .filter(({ item }) => item.issue)
        .map(({ item }) => ({ cartItemId: item.id, variantId: item.variant.id, ...item.issue }));

    return { priced, issues };
}

// Read-only snapshot of what the user would buy. `addressId` selects one of
// the user's addresses; anything else falls back to their default.
export async function getCheckout(userId, { addressId } = {}) {
    const [{ priced, issues }, addresses] = await Promise.all([
        loadCartItems(prisma, userId),
        listAddresses(userId),
    ]);

    const items = priced.map(({ item }) => item);

    // listAddresses puts defaults first, so [0] is the best fallback.
    const address = addresses.find((item) => item.id === addressId) ?? addresses[0] ?? null;

    const isEmpty = items.length === 0;
    const valid = !isEmpty && issues.length === 0;

    return {
        items,
        itemCount: items.reduce((count, item) => count + item.quantity, 0),
        summary: calculateTotals(priced, { address }),
        addresses,
        selectedAddressId: address?.id ?? null,
        validation: {
            // Cart can be bought as it is; canProceed also needs an address.
            valid,
            isEmpty,
            hasAddress: Boolean(address),
            canProceed: valid && Boolean(address),
            issues,
        },
    };
}
