import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { loadCartItems } from "./checkoutService.js";
import { calculateTotals, lineTotalOf, roundMoney, toMoney } from "./pricingService.js";

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

// Only orders that have not progressed yet can be cancelled by the customer,
// and only while unpaid (refunds do not exist yet).
const CANCELLABLE_STATUSES = ["PENDING"];
const CANCELLABLE_PAYMENT_STATUSES = ["UNPAID"];

// Matches the PaymentMethod enum. COD orders are fulfilled while unpaid;
// RAZORPAY orders must be PAID (verified with Razorpay) before fulfilment.
export const PAYMENT_METHODS = ["COD", "RAZORPAY"];

// How long an online order holds its stock while waiting for payment. The
// deadline is stored on the order (reservationExpiresAt) from the server
// clock; an order still PENDING and unpaid at or after it is due for expiry
// (see services/reservationService.js). COD orders have no deadline.
export const RESERVATION_MINUTES = 30;
export const RESERVATION_MS = RESERVATION_MINUTES * 60 * 1000;

export const UNPAID_PAYMENT_STATUSES = ["UNPAID", "FAILED"];

// The reservation deadline has been reached (the boundary itself counts as expired).
export const reservationEnded = (order, now = new Date()) => order.reservationExpiresAt != null
    && order.reservationExpiresAt.getTime() <= now.getTime();

// Online orders that can still be paid: not yet paid, not cancelled or moved
// on, and still inside the reservation window. (A payment that is already in
// flight when the window ends is still settled; see paymentService.)
export const isPayable = (order, now = new Date()) => order.paymentMethod === "RAZORPAY"
    && order.status === "PENDING" && UNPAID_PAYMENT_STATUSES.includes(order.paymentStatus)
    && !reservationEnded(order, now);

// An online order that has not been paid cannot enter fulfilment.
const awaitsPayment = (order) => order.paymentMethod === "RAZORPAY" && order.paymentStatus !== "PAID";

const REQUIRED_ADDRESS_FIELDS = ["firstName", "lastName", "phone", "address", "city", "state", "zipCode", "country"];

const orderSelect = {
    id: true,
    orderNumber: true,
    status: true,
    paymentStatus: true,
    paymentMethod: true,
    paidAt: true,
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
    reservationExpiresAt: true,
    expiredAt: true,
    // Captured payments still waiting for a manual refund.
    _count: { select: { unappliedPayments: { where: { refundedAt: null } } } },
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
        // Payment is separate from fulfilment; only server-side verification sets PAID.
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paidAt: order.paidAt,
        // An online order the customer can (still) pay for, and until when.
        payable: isPayable(order),
        paymentDueBy: isPayable(order) ? order.reservationExpiresAt : null,
        // Cancelled by the server because it was not paid in time.
        expired: order.expiredAt != null,
        // A payment was received that could not be applied (e.g. it arrived
        // after the order expired and the stock was gone); it is to be refunded.
        refundDue: (order._count?.unappliedPayments ?? 0) > 0,
        cancellable: CANCELLABLE_STATUSES.includes(order.status)
            && CANCELLABLE_PAYMENT_STATUSES.includes(order.paymentStatus),
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
| 3. Price everything with pricingService. The order takes the cart's one
|    currency (a cart with items in another currency has an issue and stops at 2).
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

async function placeOrder(tx, userId, { addressId, expectedTotal, expectedCurrency, paymentMethod = "COD" }, hooks) {
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

    const { priced, issues, currency } = await loadCartItems(tx, userId);

    if (priced.length === 0) {
        throw new ApiError(409, "Your cart is empty", [{ field: "cart", message: "Your cart is empty" }]);
    }

    if (issues.length) {
        throw stockConflict(issues);
    }

    await step("validated");

    // Decimals from the one pricing policy; stored exactly as calculated.
    const totals = calculateTotals(priced, { address });

    // The total (and currency) the customer saw at checkout. If either changed
    // since, stop before touching stock so they can review the new total.
    if ((expectedTotal != null && !roundMoney(expectedTotal).equals(totals.total))
        || (expectedCurrency != null && expectedCurrency !== currency)) {
        throw new ApiError(409, "Prices have changed since you opened checkout. Please review the updated total.", [
            { field: "expectedTotal", code: "PRICE_CHANGED", message: `The total is now ${toMoney(totals.total).toFixed(2)} ${currency}` },
        ]);
    }

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

    const placedAt = new Date();

    const order = await tx.order.create({
        data: {
            orderNumber: generateOrderNumber(),
            userId,
            paymentMethod,
            placedAt,
            // Online orders hold this stock only until the payment deadline.
            reservationExpiresAt: paymentMethod === "RAZORPAY" ? new Date(placedAt.getTime() + RESERVATION_MS) : null,
            ...totals,
            currency,
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
                    lineTotal: lineTotalOf(unitPrice, quantity),
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

// No payment is taken here: the order is created PENDING and UNPAID, with the
// server's prices. For RAZORPAY orders, paymentService then collects payment
// against this stored total and marks it PAID only after verification.
export async function createOrder(userId, { addressId, expectedTotal, expectedCurrency, paymentMethod }, hooks) {
    for (let attempt = 1; ; attempt++) {
        try {
            const order = await prisma.$transaction((tx) => placeOrder(tx, userId, { addressId, expectedTotal, expectedCurrency, paymentMethod }, hooks), TRANSACTION_OPTIONS);

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

// Order history page size. maxPage keeps the offset a safe integer.
export const ORDER_PAGINATION = { defaultLimit: 10, maxLimit: 50, maxPage: 10_000 };

// One page of the signed-in user's orders, newest first, as list rows (no
// item details). id breaks ties between orders placed in the same instant, so
// pages never overlap or skip an order. A page past the end is empty.
export async function listOrders(userId, { page, limit }) {
    const where = { userId };

    const [total, orders] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                orderNumber: true,
                status: true,
                paymentStatus: true,
                paymentMethod: true,
                total: true,
                currency: true,
                createdAt: true,
                reservationExpiresAt: true,
                items: { select: { quantity: true } },
            },
        }),
    ]);

    return {
        // reservationExpiresAt is read only to decide `payable`; list rows keep their fields.
        data: orders.map(({ items, total: orderTotal, reservationExpiresAt, ...order }) => ({
            ...order,
            total: toMoney(orderTotal),
            itemCount: items.reduce((count, item) => count + item.quantity, 0),
            payable: isPayable({ ...order, reservationExpiresAt }),
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

/*
|--------------------------------------------------------------------------
| Admin fulfilment
|--------------------------------------------------------------------------
| Admins see every order and move it forward one step at a time:
| PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED. Each step is a
| conditional UPDATE on the expected previous status, so two admins (or an
| admin and a customer cancelling) can never both win. Cancelled and refunded
| orders never move. An online (RAZORPAY) order must be PAID before any step;
| COD orders move while unpaid. No step touches payment status, prices, items
| or stock.
*/

// Matches the OrderStatus enum in prisma/schema.prisma.
export const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

export const FULFILMENT_STEPS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

// The status an admin may move an order to next, or null (final or off the path).
export function nextStatusOf(status) {
    const index = FULFILMENT_STEPS.indexOf(status);

    return index >= 0 && index < FULFILMENT_STEPS.length - 1 ? FULFILMENT_STEPS[index + 1] : null;
}

// What an admin may do next with this order: null while an online order is unpaid.
const adminNextStatus = (order) => (awaitsPayment(order) ? null : nextStatusOf(order.status));

const STEP_TIMESTAMPS = { SHIPPED: "shippedAt", DELIVERED: "deliveredAt" };

export const ADMIN_ORDER_PAGINATION = { defaultLimit: 20, maxLimit: 100 };

// One page of all customers' orders, newest first; optionally one status,
// and optionally only orders with (refundDue true) or without (false) a
// captured payment still waiting for a refund.
const OPEN_REFUND = { refundedAt: null };

export async function listAdminOrders({ page, limit, status, refundDue }) {
    const where = {
        ...(status && { status }),
        ...(refundDue === true && { unappliedPayments: { some: OPEN_REFUND } }),
        ...(refundDue === false && { unappliedPayments: { none: OPEN_REFUND } }),
    };

    const [total, orders] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                orderNumber: true,
                status: true,
                paymentStatus: true,
                paymentMethod: true,
                total: true,
                currency: true,
                createdAt: true,
                shippingFirstName: true,
                shippingLastName: true,
                shippingEmail: true,
                items: { select: { quantity: true } },
                _count: { select: { unappliedPayments: { where: { refundedAt: null } } } },
            },
        }),
    ]);

    return {
        data: orders.map(({ items, total: orderTotal, shippingFirstName, shippingLastName, shippingEmail, _count, ...order }) => ({
            ...order,
            refundDue: _count.unappliedPayments > 0,
            total: toMoney(orderTotal),
            itemCount: items.reduce((count, item) => count + item.quantity, 0),
            customer: { name: `${shippingFirstName} ${shippingLastName}`.trim(), email: shippingEmail },
            awaitingPayment: awaitsPayment(order),
            nextStatus: adminNextStatus(order),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

// The stored order snapshot (same shape as a customer's GET /orders/:id,
// without the customer-only `cancellable`), plus fulfilment fields.
export async function getAdminOrder(id) {
    const order = await prisma.order.findUnique({
        where: { id },
        select: {
            ...orderSelect, userId: true, shippedAt: true, deliveredAt: true, razorpayOrderId: true, razorpayPaymentId: true,
            unappliedPayments: {
                select: { razorpayPaymentId: true, amount: true, currency: true, reason: true, createdAt: true, refundedAt: true, razorpayRefundId: true },
                orderBy: { id: "asc" },
            },
        },
    });

    if (!order) throw new ApiError(404, "Order not found");

    const { cancellable, payable, paymentDueBy, ...response } = toOrderResponse(order);

    return {
        ...response,
        userId: order.userId,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        reservationExpiresAt: order.reservationExpiresAt,
        expiredAt: order.expiredAt,
        // Gateway references, for reconciliation in the Razorpay dashboard.
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId,
        // Captured payments that could not be applied: refund them in the
        // Razorpay dashboard; refundedAt is set once Razorpay confirms it.
        // Amounts are in minor units (cents, paise), as Razorpay reports them.
        unappliedPayments: order.unappliedPayments,
        awaitingPayment: awaitsPayment(order),
        nextStatus: adminNextStatus(order),
    };
}

const statusLabel = (status) => status.toLowerCase();

// `status` is the step the admin asked for; the server decides which status
// the order must currently have for that step to be allowed.
export async function advanceOrderStatus(id, status) {
    const from = FULFILMENT_STEPS[FULFILMENT_STEPS.indexOf(status) - 1];

    if (!from) throw new ApiError(422, "Validation failed", [{ field: "status", message: "status is not a fulfilment step" }]);

    const timestamp = STEP_TIMESTAMPS[status];
    // Same conditional UPDATE, plus the payment rule: COD, or online and PAID.
    const { count } = await prisma.order.updateMany({
        where: { id, status: from, OR: [{ paymentMethod: "COD" }, { paymentStatus: "PAID" }] },
        data: { status, ...(timestamp && { [timestamp]: new Date() }) },
    });

    if (count === 0) {
        const current = await prisma.order.findUnique({ where: { id }, select: { status: true, paymentMethod: true, paymentStatus: true } });

        if (!current) throw new ApiError(404, "Order not found");

        if (current.status === from && awaitsPayment(current)) {
            throw new ApiError(409, `This order is awaiting online payment and cannot be marked ${statusLabel(status)}`);
        }

        throw new ApiError(409, current.status === status
            ? `This order is already ${statusLabel(status)}`
            : `This order is ${statusLabel(current.status)} and cannot be marked ${statusLabel(status)}`);
    }

    return getAdminOrder(id);
}

// Gives every item of the order its quantity back, in variant id order (the
// order checkout locks them in). Called only inside the transaction whose
// conditional UPDATE just moved the order to CANCELLED, so the stock of one
// order is returned at most once.
async function restoreStock(tx, orderId, step) {
    const items = await tx.orderItem.findMany({
        where: { orderId, variantId: { not: null } },
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
                where: { id, userId, status: { in: CANCELLABLE_STATUSES }, paymentStatus: { in: CANCELLABLE_PAYMENT_STATUSES } },
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

            await restoreStock(tx, id, step);

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

/*
|--------------------------------------------------------------------------
| Reservation expiry and late payments (online orders)
|--------------------------------------------------------------------------
| expireOrder: one transaction. A conditional UPDATE moves the order to
| CANCELLED (setting expiredAt) only while it is still an online order,
| PENDING, unpaid and past its deadline; then its stock is given back. Paying
| the order (paymentService) is the opposite conditional UPDATE on the same
| row (PENDING + unpaid -> PAID). MySQL row-locks the order for whichever
| runs first and re-checks the other's WHERE against the committed row, so
| exactly one of them wins; the loser matches 0 rows and changes nothing.
|
| reinstateExpiredOrder: a captured payment for an order that has already
| expired. One transaction, and one decision made under the order's row lock:
| 1. Lock the order row (SELECT ... FOR UPDATE) and re-read it. Anything but
|    an expired, unpaid order of this gateway order: "CHANGED".
| 2. If this payment already has an unapplied_payments row (a refund is owed,
|    or was made), it is never used to fulfil the order: "REFUND_DUE".
| 3. Lock the items' variants (in id order, as checkout does) and check that
|    every item is still active and in stock.
| 4. Either take the stock and mark the order PENDING + PAID ("PAID"), or
|    record the payment in unapplied_payments ("REFUND_DUE"). Both happen in
|    this transaction, so a crash between deciding and recording cannot lose
|    the refund obligation: a failure rolls everything back, and the payment
|    is decided again by the next attempt (webhook retry, refresh, or the
|    expiry worker's late-payment check).
| Any later attempt with the same payment waits for the lock and then sees
| the committed outcome, so one payment is never both refunded and fulfilled.
*/

// unapplied_payments.reason for a late payment whose order could not be reinstated.
export const LATE_PAYMENT_STOCK_UNAVAILABLE = "expired_stock_unavailable";

export async function expireOrder(id, now = new Date(), hooks) {
    return prisma.$transaction(async (tx) => {
        const step = async (name) => hooks?.afterStep?.(name, tx);

        const { count } = await tx.order.updateMany({
            where: {
                id,
                paymentMethod: "RAZORPAY",
                status: "PENDING",
                paymentStatus: { in: UNPAID_PAYMENT_STATUSES },
                reservationExpiresAt: { lte: now },
            },
            data: { status: "CANCELLED", expiredAt: now },
        });

        if (count === 0) return false;

        await step("status");

        await restoreStock(tx, id, step);

        return true;
    }, TRANSACTION_OPTIONS);
}

// MySQL returns BOOLEAN columns from raw queries as 0/1.
const flag = (value) => Boolean(Number(value));

// Every item of the order can be sold again: its variant still exists and is
// active, its product is active, and the stock covers the quantity. The
// variant rows are locked (in id order) until the transaction ends.
async function lockAndCheckStock(tx, orderId) {
    const items = await tx.orderItem.findMany({
        where: { orderId },
        select: { variantId: true, quantity: true },
        orderBy: { variantId: "asc" },
    });

    // A variant deleted since the order was placed cannot be sold again.
    if (items.some((item) => item.variantId == null)) return { available: false, items };
    if (items.length === 0) return { available: true, items };

    const needed = new Map();
    for (const { variantId, quantity } of items) needed.set(variantId, (needed.get(variantId) ?? 0) + quantity);
    const ids = [...needed.keys()].sort((a, b) => a - b);

    const variants = await tx.$queryRaw`
        SELECT id, productId, stock, isActive FROM product_variants
        WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
    const products = await tx.product.findMany({
        where: { id: { in: [...new Set(variants.map((v) => Number(v.productId)))] } },
        select: { id: true, isActive: true },
    });

    const available = ids.every((id) => {
        const variant = variants.find((v) => Number(v.id) === id);
        const product = variant && products.find((p) => p.id === Number(variant.productId));
        return variant && flag(variant.isActive) && product?.isActive && Number(variant.stock) >= needed.get(id);
    });

    return { available, items };
}

// "PAID" (reinstated and paid), "REFUND_DUE" (the payment is recorded in
// unapplied_payments, now or earlier; the order stays cancelled) or "CHANGED"
// (no longer an expired unpaid order of this gateway order; re-read it). A
// unique-key error on orders.razorpayPaymentId (the payment already paid
// another order) is left to the caller. `payment` is a captured payment of
// exactly the order's amount and currency (checked by paymentService).
export async function reinstateExpiredOrder(order, payment, hooks) {
    return prisma.$transaction(async (tx) => {
        const step = async (name) => hooks?.afterStep?.(name, tx);

        const [current] = await tx.$queryRaw`
            SELECT status, paymentStatus, paymentMethod, razorpayOrderId, expiredAt FROM orders
            WHERE id = ${order.id} FOR UPDATE`;

        if (!current || current.paymentMethod !== "RAZORPAY" || current.razorpayOrderId !== payment.order_id
            || current.status !== "CANCELLED" || current.expiredAt == null
            || !UNPAID_PAYMENT_STATUSES.includes(current.paymentStatus)) {
            return "CHANGED";
        }

        // A locking read: the latest committed row, not this transaction's snapshot.
        const [owed] = await tx.$queryRaw`
            SELECT id FROM unapplied_payments WHERE razorpayPaymentId = ${payment.id} FOR SHARE`;

        if (owed) return "REFUND_DUE";

        const { available, items } = await lockAndCheckStock(tx, order.id);

        await step("checked");

        if (!available) {
            await tx.unappliedPayment.create({
                data: {
                    orderId: order.id,
                    razorpayPaymentId: payment.id,
                    razorpayOrderId: payment.order_id,
                    amount: payment.amount,
                    currency: payment.currency,
                    reason: LATE_PAYMENT_STOCK_UNAVAILABLE,
                },
            });

            await step("refund_due");

            return "REFUND_DUE";
        }

        const { count } = await tx.order.updateMany({
            where: { id: order.id, status: "CANCELLED", paymentStatus: { in: UNPAID_PAYMENT_STATUSES } },
            data: { status: "PENDING", paymentStatus: "PAID", razorpayPaymentId: payment.id, paidAt: new Date() },
        });

        if (count !== 1) throw new Error("Expired order changed while locked");

        await step("status");

        for (const { variantId, quantity } of items) {
            // Checked above under the same lock; the condition is a second guard.
            const { count: taken } = await tx.productVariant.updateMany({
                where: { id: variantId, isActive: true, stock: { gte: quantity } },
                data: { stock: { decrement: quantity } },
            });

            if (taken === 0) throw new Error("Stock changed while locked");

            await step("stock");
        }

        return "PAID";
    }, TRANSACTION_OPTIONS);
}
