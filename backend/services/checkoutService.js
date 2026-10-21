import prisma from "../config/db.js";
import { listAddresses } from "./addressService.js";
import {
    calculateTotals, serializeTotals, toMoney, unitPriceOf, originalPriceOf, lineTotalOf, currencyOf, MIXED_CURRENCY,
} from "./pricingService.js";

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
                    currency: true,
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
// `currency` is the cart's currency: that of its first (oldest) item.
function findIssue({ quantity, variant }, currency) {
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

    if (variant.product.currency !== currency) {
        return {
            code: MIXED_CURRENCY,
            message: `This item is priced in ${variant.product.currency}, but the rest of your cart is in ${currency}. Remove it to check out.`,
        };
    }

    return null;
}

// Prices always come from the database, through pricingService's one rule.
function toCheckoutItem(row, currency) {
    const { id, quantity, variant } = row;
    const { product } = variant;
    const unitPrice = unitPriceOf(variant, product);
    const originalPrice = originalPriceOf(variant, product);
    const issue = findIssue(row, currency);

    return {
        id,
        quantity,
        unitPrice,
        item: {
            id,
            quantity,
            unitPrice: toMoney(unitPrice),
            originalPrice: originalPrice == null ? null : toMoney(originalPrice),
            subtotal: toMoney(lineTotalOf(unitPrice, quantity)),
            isAvailable: !issue,
            issue,
            product: {
                id: product.id,
                name: product.name,
                slug: product.slug,
                brand: product.brand,
                currency: product.currency,
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
// Returns { priced: [{ id, quantity, unitPrice: Decimal, item }], issues, currency }:
// `currency` is the first item's, and any item priced in another currency is
// an issue, so a cart without issues is entirely in `currency`.
export async function loadCartItems(client, userId) {
    const rows = await client.cartItem.findMany({
        where: { cart: { userId } },
        select: itemSelect,
        orderBy: { createdAt: "asc" },
    });

    const currency = rows[0]?.variant.product.currency ?? null;
    const priced = rows.map((row) => toCheckoutItem(row, currency));

    const issues = priced
        .filter(({ item }) => item.issue)
        .map(({ item }) => ({ cartItemId: item.id, variantId: item.variant.id, ...item.issue }));

    return { priced, issues, currency };
}

// Read-only snapshot of what the user would buy. `addressId` selects one of
// the user's addresses; anything else falls back to their default.
export async function getCheckout(userId, { addressId } = {}) {
    const [{ priced, issues, currency }, addresses] = await Promise.all([
        loadCartItems(prisma, userId),
        listAddresses(userId),
    ]);

    const items = priced.map(({ item }) => item);

    // listAddresses puts defaults first, so [0] is the best fallback.
    const address = addresses.find((item) => item.id === addressId) ?? addresses[0] ?? null;

    const isEmpty = items.length === 0;
    const valid = !isEmpty && issues.length === 0;
    // From the products, not the issues: an item can show only one issue (e.g. out of stock).
    const mixedCurrency = !isEmpty && currencyOf(items.map((item) => item.product)) === null;

    return {
        items,
        itemCount: items.reduce((count, item) => count + item.quantity, 0),
        // Same calculation order creation uses, so this is the total that will be
        // stored. A mixed cart is never totalled (as GET /cart): amounts in
        // different currencies are not added up, and every amount is null.
        summary: mixedCurrency
            ? { subtotal: null, shipping: null, tax: null, discount: null, total: null, currency: null }
            : { ...serializeTotals(calculateTotals(priced, { address })), currency },
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
