import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";
import { couponDiscountOf, toMoney } from "./pricingService.js";

/*
|--------------------------------------------------------------------------
| Coupons: public promotional codes
|--------------------------------------------------------------------------
| A coupon can be applied to a cart when, at that moment:
|   it exists (codes are compared upper-cased), it is active, now is within
|   [startsAt, expiresAt), the cart is in the coupon's currency, the
|   merchandise subtotal reaches minimumOrderAmount, usedCount is below
|   usageLimit, and this customer's orders holding a use are below
|   usageLimitPerUser.
| The discount itself is computed by pricingService (couponDiscountOf), from
| database prices only; a discount sent by a client is never read.
|
| Usage follows the same lifecycle as reserved stock:
|   claim   - inside the order's transaction (placeOrder): a conditional
|             UPDATE usedCount = usedCount + 1 WHERE every rule above still
|             holds. MySQL row-locks the coupon and re-checks the WHERE on the
|             latest committed row, so concurrent orders can never take more
|             than usageLimit uses: the loser matches 0 rows, and its whole
|             order rolls back.
|   release - in the transaction that cancels the order (customer cancel or
|             reservation expiry): usedCount - 1.
|   reclaim - when a late payment reinstates an expired order: usedCount + 1
|             without the limit check, because the customer has already paid
|             the discounted total.
| Validating a coupon (checkout preview, POST /coupons/validate) never
| changes usedCount.
|
| Lock order everywhere: orders -> coupon -> product variants, so placing,
| cancelling, expiring and reinstating orders cannot deadlock on each other.
*/

// Up to 40 characters: letters, digits, '-' and '_', starting with a letter or digit.
export const COUPON_CODE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

export const normalizeCode = (code) => String(code ?? "").trim().toUpperCase();

// The codes a customer sees, with the field they belong to.
const problem = (code, message, status = 422) => new ApiError(status, message, [{ field: "couponCode", code, message }]);

const formatAmount = (value, currency) => `${toMoney(value).toFixed(2)} ${currency}`;

// Every rule that needs only the coupon row, the cart and the clock.
function couponProblem(coupon, { subtotal, currency, now }) {
    if (!coupon) return problem("COUPON_NOT_FOUND", "This coupon code is not valid");
    if (!coupon.isActive) return problem("COUPON_INACTIVE", "This coupon is no longer active");
    if (coupon.startsAt.getTime() > now.getTime()) return problem("COUPON_NOT_STARTED", "This coupon is not valid yet");
    if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return problem("COUPON_EXPIRED", "This coupon has expired");

    if (currency !== coupon.currency) {
        return problem("COUPON_CURRENCY", `This coupon can only be used on orders in ${coupon.currency}`);
    }

    if (new Prisma.Decimal(subtotal).lessThan(coupon.minimumOrderAmount)) {
        return problem("COUPON_MINIMUM_NOT_MET",
            `This coupon needs a minimum order of ${formatAmount(coupon.minimumOrderAmount, coupon.currency)}`);
    }

    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
        return problem("COUPON_USAGE_LIMIT", "This coupon has reached its usage limit");
    }

    return null;
}

const userLimitReached = () => problem("COUPON_USER_LIMIT", "You have already used this coupon the maximum number of times");

// Orders of this customer that hold a use of the coupon (every order not cancelled).
const usesByUser = (client, couponId, userId) => client.order.count({
    where: { couponId, userId, status: { not: "CANCELLED" } },
});

/*
| Checks a code against the customer's cart and returns { coupon, discount }
| (discount a Decimal), or throws a 422 ApiError whose details carry the
| reason (field "couponCode"). Read-only. `client` is prisma or a transaction.
| `subtotal` must be the merchandise subtotal from pricingService.
*/
export async function evaluateCoupon(client, userId, code, { subtotal, currency, now = new Date() }) {
    const normalized = normalizeCode(code);

    const coupon = COUPON_CODE.test(normalized)
        ? await client.coupon.findUnique({ where: { code: normalized } })
        : null;

    const found = couponProblem(coupon, { subtotal, currency, now });
    if (found) throw found;

    if (coupon.usageLimitPerUser != null && await usesByUser(client, coupon.id, userId) >= coupon.usageLimitPerUser) {
        throw userLimitReached();
    }

    return { coupon, discount: couponDiscountOf(coupon, subtotal) };
}

/*
| Takes one use of `coupon` for an order being placed in transaction `tx`.
| Call after evaluateCoupon (for the messages) and before touching stock.
| Throws a 422 ApiError if any rule stopped holding in the meantime; the
| caller's transaction then rolls back, so nothing is ever half-claimed.
*/
export async function claimCoupon(tx, coupon, userId, now = new Date()) {
    // Per customer: a plain (non-locking) count. One customer's orders are
    // serialised by the cart row lock placeOrder takes first, and this
    // transaction's snapshot starts after that lock, so it sees every order of
    // theirs already committed. The most it can miss is a cancellation
    // committed meanwhile, which only over-counts (refuses, never over-spends).
    // A locking read (FOR SHARE) must not be used: its gap locks on
    // orders(couponId, userId) block other customers' order inserts and
    // deadlock concurrent orders using the same coupon.
    if (coupon.usageLimitPerUser != null && await usesByUser(tx, coupon.id, userId) >= coupon.usageLimitPerUser) {
        throw userLimitReached();
    }

    const claimed = await tx.$executeRaw`
        UPDATE coupons SET usedCount = usedCount + 1, updatedAt = CURRENT_TIMESTAMP(3)
        WHERE id = ${coupon.id}
          AND isActive = TRUE
          AND startsAt <= ${now}
          AND (expiresAt IS NULL OR expiresAt > ${now})
          AND (usageLimit IS NULL OR usedCount < usageLimit)`;

    if (claimed === 1) return;

    // Changed since it was evaluated (deactivated, expired or used up by
    // another order): report the current reason.
    const [current] = await tx.$queryRaw`SELECT * FROM coupons WHERE id = ${coupon.id} FOR SHARE`;
    const row = current && {
        ...current,
        isActive: Boolean(Number(current.isActive)),
        usedCount: Number(current.usedCount),
        usageLimit: current.usageLimit == null ? null : Number(current.usageLimit),
    };

    // The cart was already checked against the minimum and currency, so only
    // the coupon's own state is re-checked here.
    throw couponProblem(row, { subtotal: coupon.minimumOrderAmount, currency: coupon.currency, now })
        ?? problem("COUPON_USAGE_LIMIT", "This coupon has reached its usage limit");
}

// Gives back the use held by an order, inside the transaction whose
// conditional UPDATE just cancelled it (so at most once per order). Call
// before restoring stock (lock order: coupon -> variants).
export async function releaseCoupon(tx, orderId) {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { couponId: true } });

    if (order?.couponId == null) return;

    await tx.$executeRaw`
        UPDATE coupons SET usedCount = usedCount - 1, updatedAt = CURRENT_TIMESTAMP(3)
        WHERE id = ${order.couponId} AND usedCount > 0`;
}

// Locks the coupon of an expired order about to be reinstated, before its
// variants are locked (see the lock order above). Returns its id or null.
export async function lockOrderCoupon(tx, orderId) {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { couponId: true } });

    if (order?.couponId == null) return null;

    await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${order.couponId} FOR UPDATE`;

    return order.couponId;
}

// A late payment reinstated the order: it holds its use again. No limit check,
// since the discounted total has already been paid.
export async function reclaimCoupon(tx, couponId) {
    if (couponId == null) return;

    await tx.$executeRaw`
        UPDATE coupons SET usedCount = usedCount + 1, updatedAt = CURRENT_TIMESTAMP(3)
        WHERE id = ${couponId}`;
}

// What a customer is shown about an applied coupon.
export function toAppliedCoupon(coupon, discount) {
    return {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: toMoney(coupon.discountValue),
        maximumDiscountAmount: coupon.maximumDiscountAmount == null ? null : toMoney(coupon.maximumDiscountAmount),
        minimumOrderAmount: toMoney(coupon.minimumOrderAmount),
        currency: coupon.currency,
        expiresAt: coupon.expiresAt,
        discount: toMoney(discount),
    };
}

/*
|--------------------------------------------------------------------------
| Admin
|--------------------------------------------------------------------------
*/

export const ADMIN_COUPON_PAGINATION = { defaultLimit: 20, maxLimit: 100 };

const FIELDS = [
    "code", "description", "discountType", "discountValue", "currency", "minimumOrderAmount",
    "maximumDiscountAmount", "usageLimit", "usageLimitPerUser", "startsAt", "expiresAt", "isActive",
];

const pick = (data) => Object.fromEntries(FIELDS.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));

// The state an admin sees, derived from the row and the clock.
function couponStatus(coupon, now = new Date()) {
    if (!coupon.isActive) return "INACTIVE";
    if (coupon.startsAt.getTime() > now.getTime()) return "SCHEDULED";
    if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return "USED_UP";
    return "ACTIVE";
}

function toAdminCoupon(coupon) {
    const money = (value) => (value == null ? null : toMoney(value));

    return {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: money(coupon.discountValue),
        currency: coupon.currency,
        minimumOrderAmount: money(coupon.minimumOrderAmount),
        maximumDiscountAmount: money(coupon.maximumDiscountAmount),
        usageLimit: coupon.usageLimit,
        usageLimitPerUser: coupon.usageLimitPerUser,
        // Uses held now (orders not cancelled), and every order ever placed with it.
        usedCount: coupon.usedCount,
        orderCount: coupon._count?.orders ?? 0,
        startsAt: coupon.startsAt,
        expiresAt: coupon.expiresAt,
        isActive: coupon.isActive,
        status: couponStatus(coupon),
        // Deleting is allowed only while no order (even a cancelled one) refers to it.
        deletable: (coupon._count?.orders ?? 0) === 0,
        createdAt: coupon.createdAt,
        updatedAt: coupon.updatedAt,
    };
}

const withCount = { _count: { select: { orders: true } } };

const notFound = () => new ApiError(404, "Coupon not found");

const invalid = (field, message) => new ApiError(422, "Validation failed", [{ field, message }]);

const duplicate = () => new ApiError(409, "A coupon with this code already exists", [
    { field: "code", message: "A coupon with this code already exists" },
]);

// Rules that involve more than one field, checked on the coupon as it will be
// saved (the current row merged with the changes). `limitChanged`: the
// request sets usageLimit (only then is it compared with the uses held, since
// a late payment may legitimately leave usedCount above the limit, and the
// admin must still be able to edit or deactivate that coupon).
function assertConsistent(next, current, { limitChanged = true } = {}) {
    const value = new Prisma.Decimal(next.discountValue);

    if (next.discountType === "PERCENTAGE" && value.greaterThan(100)) {
        throw invalid("discountValue", "A percentage discount cannot be more than 100");
    }

    if (next.discountType === "FIXED" && next.maximumDiscountAmount != null) {
        throw invalid("maximumDiscountAmount", "A maximum discount applies only to percentage coupons");
    }

    if (next.expiresAt && next.startsAt && new Date(next.expiresAt).getTime() <= new Date(next.startsAt).getTime()) {
        throw invalid("expiresAt", "expiresAt must be after startsAt");
    }

    if (next.usageLimit != null && next.usageLimitPerUser != null && next.usageLimitPerUser > next.usageLimit) {
        throw invalid("usageLimitPerUser", "usageLimitPerUser cannot be more than usageLimit");
    }

    if (current && limitChanged && next.usageLimit != null && next.usageLimit < current.usedCount) {
        throw invalid("usageLimit", `usageLimit cannot be lower than the ${current.usedCount} use${current.usedCount === 1 ? "" : "s"} already held by orders`);
    }
}

const isDuplicateCode = (err) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

// Deadlock, lock wait timeout or transaction timeout: nothing was committed.
// Raised by a raw statement (the coupon claim/release UPDATEs), MySQL's
// 1213/1205 arrive as P2010 (raw query failed) instead of P2034.
export const isLockFailure = (err) => err instanceof Prisma.PrismaClientKnownRequestError
    && (["P2028", "P2034"].includes(err.code)
        || (err.code === "P2010" && ["1213", "1205"].includes(String(err.meta?.driverAdapterError?.cause?.originalCode))));

async function guarded(fn) {
    try {
        return await fn();
    } catch (err) {
        if (err instanceof ApiError) throw err;
        if (isDuplicateCode(err)) throw duplicate();
        if (isLockFailure(err)) throw new ApiError(409, "The coupon changed while saving; please try again");
        throw err;
    }
}

export async function listAdminCoupons({ page, limit, search, isActive }) {
    const where = {
        ...(search && { code: { contains: normalizeCode(search) } }),
        ...(isActive !== undefined && { isActive }),
    };

    const [total, rows] = await prisma.$transaction([
        prisma.coupon.count({ where }),
        prisma.coupon.findMany({
            where,
            include: withCount,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);

    return {
        data: rows.map(toAdminCoupon),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

// The coupon and the most recent orders placed with it.
export async function getAdminCoupon(id) {
    const coupon = await prisma.coupon.findUnique({ where: { id }, include: withCount });

    if (!coupon) throw notFound();

    const orders = await prisma.order.findMany({
        where: { couponId: id },
        select: {
            id: true, orderNumber: true, status: true, paymentStatus: true, discount: true, total: true,
            currency: true, placedAt: true, shippingEmail: true,
        },
        orderBy: [{ placedAt: "desc" }, { id: "desc" }],
        take: 20,
    });

    return {
        ...toAdminCoupon(coupon),
        recentOrders: orders.map((order) => ({
            ...order,
            email: order.shippingEmail,
            shippingEmail: undefined,
            discount: toMoney(order.discount),
            total: toMoney(order.total),
        })),
    };
}

export async function createCoupon(data) {
    const values = pick(data);
    const next = {
        minimumOrderAmount: "0",
        maximumDiscountAmount: null,
        usageLimit: null,
        usageLimitPerUser: null,
        startsAt: new Date(),
        expiresAt: null,
        ...values,
    };

    assertConsistent(next, null);

    const coupon = await guarded(() => prisma.coupon.create({ data: next, include: withCount }));

    return toAdminCoupon(coupon);
}

// The row is locked while the merged values are checked, so a concurrent
// order claiming a use cannot slip under a lowered usageLimit unnoticed.
export async function updateCoupon(id, data) {
    const changes = pick(data);

    const coupon = await guarded(() => prisma.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${id} FOR UPDATE`;
        if (!locked) throw notFound();

        const current = await tx.coupon.findUnique({ where: { id } });

        // Switching to FIXED drops a cap that applied only to percentages.
        if (changes.discountType === "FIXED" && changes.maximumDiscountAmount === undefined) {
            changes.maximumDiscountAmount = null;
        }

        assertConsistent({ ...current, ...changes }, current, { limitChanged: changes.usageLimit !== undefined });

        return tx.coupon.update({ where: { id }, data: changes, include: withCount });
    }));

    return toAdminCoupon(coupon);
}

export const setCouponActive = (id, isActive) => updateCoupon(id, { isActive });

// Only a coupon no order has ever used; otherwise it can be deactivated. The
// row lock keeps an order from claiming it between the check and the delete
// (and the orders foreign key refuses the delete regardless).
export async function deleteCoupon(id) {
    return guarded(() => prisma.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${id} FOR UPDATE`;
        if (!locked) throw notFound();

        const orders = await tx.order.count({ where: { couponId: id } });

        if (orders > 0) {
            throw new ApiError(409, `This coupon has been used on ${orders} order${orders === 1 ? "" : "s"} and can only be deactivated`);
        }

        await tx.coupon.delete({ where: { id } });

        return { id, deleted: true };
    }).catch((err) => {
        // Defence in depth: the foreign key refused it.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
            throw new ApiError(409, "This coupon has been used on orders and can only be deactivated");
        }
        throw err;
    }));
}
