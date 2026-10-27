import { apiClient } from "./apiClient";

// The signed-in user's saved products. The server takes the user from the
// token; requests only name the product. Adding and removing are idempotent.
export const wishlistService = {

    // Newest first, in the GET /products list-item shape plus addedAt, and
    // variantId/variantStock when the product has exactly one variant.
    async list() {
        const { data } = await apiClient.get("/wishlist");

        return data.data;
    },

    // -> { productId, added }
    async add(productId) {
        const { data } = await apiClient.put(`/wishlist/${productId}`);

        return data.data;
    },

    // -> { productId, removed }
    async remove(productId) {
        const { data } = await apiClient.delete(`/wishlist/${productId}`);

        return data.data;
    },

};
