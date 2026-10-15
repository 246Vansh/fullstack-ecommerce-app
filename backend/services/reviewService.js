import { Prisma } from "@prisma/client";

import prisma from "../config/db.js";
import { ApiError } from "../utils/ApiError.js";

/*
|--------------------------------------------------------------------------
| Product reviews
|--------------------------------------------------------------------------
| One review per customer per product (unique userId + productId), so the
| signed-in customer's review is addressed by product, never by review id:
| another customer's review cannot be reached, let alone changed.
|
| - Only customers review. The token's role can be up to 15 minutes old, so
|   writes re-read it from the database (as requireCurrentAdmin does).
| - "Verified purchase" is never stored or read from the client: it is true
|   while the author has a DELIVERED order containing the product.
| - Public responses carry the author as "First L." only; no email, user id
|   or order data leaves this module.
| - An inactive or missing product behaves as not found, as on GET /products/:id.
*/

export const REVIEW_PAGINATION = { defaultLimit: 10, maxLimit: 50 };

// Same limits as the Review.body column (VARCHAR(2000)) and the validators.
export const REVIEW_BODY = { min: 10, max: 2000 };

const reviewSelect = {
    id: true,
    userId: true,
    rating: true,
    body: true,
    createdAt: true,
    updatedAt: true,
    user: { select: { firstName: true, lastName: true } },
};

// "Jane D." from first name and last initial; "Jane" without a last name,
// and a generic label when there is no first name either.
export function authorName(firstName, lastName) {
    const first = (firstName ?? "").trim();
    const initial = Array.from((lastName ?? "").trim())[0];

    if (!first) return "Customer";

    return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

// The public shape. userId is used here and dropped.
function toReview({ userId, user, ...review }, verifiedUserIds) {
    return {
        ...review,
        author: authorName(user.firstName, user.lastName),
        verifiedPurchase: verifiedUserIds.has(userId),
    };
}

// Of these users, the ones with a DELIVERED order containing the product.
async function verifiedBuyers(productId, userIds) {
    if (!userIds.length) return new Set();

    const orders = await prisma.order.findMany({
        where: { userId: { in: userIds }, status: "DELIVERED", items: { some: { productId } } },
        select: { userId: true },
        distinct: ["userId"],
    });

    return new Set(orders.map((order) => order.userId));
}

async function assertActiveProduct(productId) {
    const product = await prisma.product.findFirst({ where: { id: productId, isActive: true }, select: { id: true } });

    if (!product) {
        throw new ApiError(404, "Product not found");
    }
}

async function assertCustomer(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });

    if (!user) {
        throw new ApiError(401, "Authentication required");
    }

    if (user.role !== "CUSTOMER") {
        throw new ApiError(403, "Only customers can review products");
    }
}

// Unique-key races and records removed mid-request, as the pre-checks would report them.
function rethrow(err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") throw new ApiError(409, "You have already reviewed this product");
        if (err.code === "P2025") throw new ApiError(404, "Review not found");
        if (err.code === "P2003") throw new ApiError(404, "Product not found");
    }

    throw err;
}

async function toOwnReview(review, productId) {
    return toReview(review, await verifiedBuyers(productId, [review.userId]));
}

const ownKey = (userId, productId) => ({ userId_productId: { userId, productId } });

// One page of a product's reviews, newest first (id breaks ties), plus the
// rating summary for all of them. A page past the end is empty.
export async function listReviews(productId, { page, limit }) {
    await assertActiveProduct(productId);

    const where = { productId };

    const [summary, reviews] = await Promise.all([
        prisma.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
        prisma.review.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * limit,
            take: limit,
            select: reviewSelect,
        }),
    ]);

    const verified = await verifiedBuyers(productId, [...new Set(reviews.map((review) => review.userId))]);
    const total = summary._count._all;
    const average = summary._avg.rating;

    return {
        data: reviews.map((review) => toReview(review, verified)),
        summary: {
            averageRating: average == null ? null : Math.round(Number(average) * 10) / 10,
            reviewCount: total,
        },
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

// The signed-in customer's review of the product, or null.
export async function getOwnReview(userId, productId) {
    await assertActiveProduct(productId);

    const review = await prisma.review.findUnique({ where: ownKey(userId, productId), select: reviewSelect });

    return review ? toOwnReview(review, productId) : null;
}

export async function createReview(userId, productId, { rating, body }) {
    await assertCustomer(userId);
    await assertActiveProduct(productId);

    // No pre-check for an existing review: the unique key decides, including
    // between two simultaneous submissions.
    const review = await prisma.review
        .create({ data: { userId, productId, rating, body }, select: reviewSelect })
        .catch(rethrow);

    return toOwnReview(review, productId);
}

export async function updateReview(userId, productId, input) {
    await assertCustomer(userId);
    await assertActiveProduct(productId);

    const data = {
        ...(input.rating !== undefined && { rating: input.rating }),
        ...(input.body !== undefined && { body: input.body }),
    };

    const review = await prisma.review
        .update({ where: ownKey(userId, productId), data, select: reviewSelect })
        .catch(rethrow);

    return toOwnReview(review, productId);
}

export async function deleteReview(userId, productId) {
    await assertCustomer(userId);
    await assertActiveProduct(productId);

    await prisma.review.delete({ where: ownKey(userId, productId), select: { id: true } }).catch(rethrow);
}
