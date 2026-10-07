import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { loadCartItems } from "./checkoutService.js";
import { calculateTotals, toMoney } from "./pricingService.js";

// Waiting for another checkout of the same variant or cart can take a moment
// under load; these bound it instead of Prisma's 2s/5s defaults.
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

const ORDER_NUMBER_ATTEMPTS = 3;

// Customer-facing number, e.g. ORD-20261001-7K3QX9MZ. 40 random bits per day
// make a collision practically impossible; the unique index catches the rest.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O, U

function generateOrderNumber(now = new Date()) {
    const date = now.toISOString().slice(0, 10).replaceAll("-", "");
    const code = [...randomBytes(8)].map((byte) => ALPHABET[byte % 32]).join("");

    return `ORD-${date}-${code}`;
}

// Only orders that have not progressed yet can be cancelled by the customer.
const CANCELLABLE_STATUSES = ["PENDING"];

const REQUIRED_ADDRESS_FIELDS = ["firstName", "lastName", "phone", "address", "city", "state", "zipCode", "country"];

const orderSelect = {
    id: true,
    orderNumber: true,
    status: true,
    currency: true,
    subtotal: true,
    shipping: true,
    tax: true,
    discount: true,
    total: true,
    placedAt: true,
    createdAt: true,
    updatedAt: true,
    shippingEmail: true,
    shippingFirstName: true,
    shippingLastName: true,
    shippingPhone: true,
    shippingAddress: true,
    shippingApartment: true,
    shippingCity: true,
    shippingState: true,
    shippingZipCode: true,
    shippingCountry: true,
    items: {
        select: {
            id: true,
            productId: true,
            variantId: true,
            productName: true,
            sku: true,
            size: true,
            color: true,
            image: true,
            unitPrice: true,
            quantity: true,
            lineTotal: true,
        },
        orderBy: { id: "asc" },
    },
};

// Built only from the persisted order snapshot, never from live catalog data.
// `orderId` duplicates `id` for the original POST response shape.
function toOrderResponse(order) {
    return {
        id: order.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        cancellable: CANCELLABLE_STATUSES.includes(order.status),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        placedAt: order.placedAt,
        currency: order.currency,
        // The email captured when the order was placed.
        email: order.shippingEmail,
        items: order.items.map((item) => ({
            ...item,
            unitPrice: toMoney(item.unitPrice),
            lineTotal: toMoney(item.lineTotal),
        })),
        subtotal: toMoney(order.subtotal),
        shipping: toMoney(order.shipping),
        tax: toMoney(order.tax),
        discount: toMoney(order.discount),
        total: toMoney(order.total),
        shippingAddress: {
            firstName: order.shippingFirstName,
            lastName: order.shippingLastName,
            phone: order.shippingPhone,
            address: order.shippingAddress,
            apartment: order.shippingApartment,
            city: order.shippingCity,
            state: order.shippingState,
            zipCode: order.shippingZipCode,
            country: order.shippingCountry,
        },
    };
}

const stockConflict = (details) => new ApiError(409, "Some items in your cart are no longer available in the requested quantity", details);

/*
|--------------------------------------------------------------------------
| The transaction
|--------------------------------------------------------------------------
| 1. Lock the user's cart row. Concurrent orders (double submit) and cart
|    edits from the same user queue here; the second order then finds the
|    cart already emptied and fails with 409.
| 2. Validate the address and every cart item against current data.
| 3. Price everything with pricingService.
| 4. Decrement stock with a conditional UPDATE (stock >= quantity). MySQL
|    row-locks the variant and re-checks the condition on the latest committed
|    row, so two buyers can never both take the last units; the loser's
|    update matches 0 rows and the whole transaction rolls back.
| 5. Create the Order with snapshot OrderItems, then clear the cart.
| Any error before commit undoes every step.
|
| `hooks.afterStep(name, tx)` is a test seam for forcing failures between
| steps; the HTTP controller never passes it.
*/

async function placeOrder(tx, userId, addressId, hooks) {
    const step = async (name) => hooks?.afterStep?.(name, tx);

    // A bare UPDATE takes the row lock before any read, so the reads below
    // see what an earlier order for this cart committed.
    const locked = await tx.cart.updateMany({ where: { userId }, data: { updatedAt: new Date() } });

    if (locked.count === 0) {
        throw new ApiError(409, "Your cart is empty", [{ field: "cart", message: "Your cart is empty" }]);
    }

    const address = await tx.address.findFirst({ where: { id: addressId, userId } });

    if (!address) {
        throw new ApiError(404, "Address not found", [{ field: "addressId", message: "Address not found" }]);
    }

    const incomplete = REQUIRED_ADDRESS_FIELDS.filter((field) => !String(address[field] ?? "").trim());

    if (incomplete.length) {
        throw new ApiError(422, "This address is incomplete and cannot be used for shipping",
            incomplete.map((field) => ({ field, message: "Required for shipping" })));
    }

    const { priced, issues } = await loadCartItems(tx, userId);

    if (priced.length === 0) {
        throw new ApiError(409, "Your cart is empty", [{ field: "cart", message: "Your cart is empty" }]);
    }

    if (issues.length) {
        throw stockConflict(issues);
    }

    await step("validated");

    const totals = calculateTotals(priced, { address });

    // Fixed order (by variant id) so two multi-item orders cannot deadlock.
    const byVariant = [...priced].sort((a, b) => a.item.variant.id - b.item.variant.id);

    for (const { quantity, item } of byVariant) {
        const { count } = await tx.productVariant.updateMany({
            where: { id: item.variant.id, isActive: true, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
        });

        if (count === 0) {
            // Bought by someone else since the validation read. A plain read
            // would return this transaction's stale snapshot; FOR SHARE reads
            // the latest committed stock for an accurate message.
            const [current] = await tx.$queryRaw`SELECT stock FROM product_variants WHERE id = ${item.variant.id} FOR SHARE`;

            const available = Number(current?.stock ?? 0);

            throw stockConflict([{
                cartItemId: item.id,
                variantId: item.variant.id,
                code: "INSUFFICIENT_STOCK",
                message: available > 0
                    ? `Only ${available} item${available === 1 ? "" : "s"} available in stock`
                    : "This item is out of stock",
            }]);
        }

        await step("stock");
    }

    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });

    const order = await tx.order.create({
        data: {
            orderNumber: generateOrderNumber(),
            userId,
            ...totals,
            shippingFirstName: address.firstName,
            shippingLastName: address.lastName,
            shippingPhone: address.phone,
            shippingEmail: user.email,
            shippingAddress: address.address,
            shippingApartment: address.apartment,
            shippingCity: address.city,
            shippingState: address.state,
            shippingZipCode: address.zipCode,
            shippingCountry: address.country,
            // Snapshot: stays correct if the product is renamed, repriced or deleted.
            items: {
                create: priced.map(({ quantity, unitPrice, item }) => ({
                    productId: item.product.id,
                    variantId: item.variant.id,
                    productName: item.product.name,
                    sku: item.variant.sku,
                    size: item.variant.size,
                    color: item.variant.color,
                    image: item.product.image,
                    unitPrice,
                    quantity,
                    lineTotal: unitPrice.mul(quantity),
                })),
            },
        },
        select: orderSelect,
    });

    await step("order");

    await tx.cartItem.deleteMany({ where: { cart: { userId } } });

    await step("cart");

    return order;
}

// orderNumber is the only unique column this transaction writes.
const isOrderNumberClash = (err) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

export async function createOrder(userId, { addressId }, hooks) {
    for (let attempt = 1; ; attempt++) {
        try {
            const order = await prisma.$transaction((tx) => placeOrder(tx, userId, addressId, hooks), TRANSACTION_OPTIONS);

            return toOrderResponse(order);
        } catch (err) {
            if (err instanceof ApiError) throw err;

            // The whole transaction rolled back; a fresh number is safe to retry.
            if (isOrderNumberClash(err) && attempt < ORDER_NUMBER_ATTEMPTS) continue;

            // Deadlock / lock wait / transaction timeout: nothing was committed.
            if (err instanceof Prisma.PrismaClientKnownRequestError && ["P2028", "P2034"].includes(err.code)) {
                throw new ApiError(409, "Your order could not be placed right now. Please try again.");
            }

            throw err;
        }
    }
}

// Only the owner's order: another user's id behaves exactly like a missing one.
export async function getOrder(userId, id) {
    const order = await prisma.order.findFirst({ where: { id, userId }, select: orderSelect });

    if (!order) {
        throw new ApiError(404, "Order not found");
    }

    return toOrderResponse(order);
}

// The signed-in user's orders, newest first, as list rows (no item details).
export async function listOrders(userId) {
    const orders = await prisma.order.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
            items: { select: { quantity: true } },
        },
    });

    return orders.map(({ items, total, ...order }) => ({
        ...order,
        total: toMoney(total),
        itemCount: items.reduce((count, item) => count + item.quantity, 0),
    }));
}

/*
|--------------------------------------------------------------------------
| Cancellation
|--------------------------------------------------------------------------
| One transaction:
| 1. Conditional UPDATE status -> CANCELLED WHERE id, userId and status is
|    cancellable. This row-locks the order and re-checks the condition on the
|    latest committed row, so of two concurrent cancels only one matches; the
|    other waits for the lock, then matches 0 rows and gets 409.
| 2. Re-read the order items and give each variant its quantity back, in
|    variant id order (the same order checkout locks them in).
| Any failure rolls back both the status change and every stock increment.
|
| `hooks.afterStep(name, tx)` is a test seam, as in placeOrder.
*/

export async function cancelOrder(userId, id, hooks) {
    const step = async (name) => hooks?.afterStep?.(name, tx);
    let tx;

    try {
        const order = await prisma.$transaction(async (transaction) => {
            tx = transaction;

            const { count } = await tx.order.updateMany({
                where: { id, userId, status: { in: CANCELLABLE_STATUSES } },
                data: { status: "CANCELLED" },
            });

            if (count === 0) {
                const current = await tx.order.findFirst({ where: { id, userId }, select: { status: true } });

                if (!current) throw new ApiError(404, "Order not found");

                throw new ApiError(409, current.status === "CANCELLED"
                    ? "This order has already been cancelled"
                    : "This order can no longer be cancelled");
            }

            await step("status");

            const items = await tx.orderItem.findMany({
                where: { orderId: id, variantId: { not: null } },
                select: { variantId: true, quantity: true },
                orderBy: { variantId: "asc" },
            });

            for (const { variantId, quantity } of items) {
                await tx.productVariant.update({
                    where: { id: variantId },
                    data: { stock: { increment: quantity } },
                });

                await step("restore");
            }

            return tx.order.findUnique({ where: { id }, select: orderSelect });
        }, TRANSACTION_OPTIONS);

        return toOrderResponse(order);
    } catch (err) {
        if (err instanceof ApiError) throw err;

        if (err instanceof Prisma.PrismaClientKnownRequestError && ["P2028", "P2034"].includes(err.code)) {
            throw new ApiError(409, "Your order could not be cancelled right now. Please try again.");
        }

        throw err;
    }
}
