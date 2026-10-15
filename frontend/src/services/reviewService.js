import { apiClient } from "./apiClient";

// Product reviews (backend/routes/reviewRoutes.js). The signed-in customer's
// own review is always addressed as /mine; reviews are never fetched or
// changed by review id, and the author comes from the session, not the body.
const reviewsUrl = (productId) => `/products/${encodeURIComponent(productId)}/reviews`;

export const reviewService = {

    // One page, newest first: { reviews, summary: { averageRating, reviewCount }, pagination }.
    async list(productId, { page, limit }, { signal } = {}) {
        const { data } = await apiClient.get(reviewsUrl(productId), { params: { page, limit }, signal });

        return { reviews: data.data, summary: data.summary, pagination: data.pagination };
    },

    // The signed-in customer's review of this product, or null. Customers only
    // (the API answers 403 for admins).
    async getMine(productId, { signal } = {}) {
        const { data } = await apiClient.get(`${reviewsUrl(productId)}/mine`, { signal });

        return data.data;
    },

    async create(productId, { rating, body }) {
        const { data } = await apiClient.post(reviewsUrl(productId), { rating, body });

        return data.data;
    },

    async update(productId, { rating, body }) {
        const { data } = await apiClient.patch(`${reviewsUrl(productId)}/mine`, { rating, body });

        return data.data;
    },

    async remove(productId) {
        await apiClient.delete(`${reviewsUrl(productId)}/mine`);
    },

};
