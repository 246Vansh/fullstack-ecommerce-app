import { apiClient } from "./apiClient";

// Every cart endpoint responds with the full cart, priced and totalled by the
// server. Only variantId and quantity are ever sent.
export const cartService = {

    async getCart() {
        const { data } = await apiClient.get("/cart");

        return data.data;
    },

    async addToCart(variantId, quantity) {
        const { data } = await apiClient.post("/cart/items", { variantId, quantity });

        return data.data;
    },

    async updateCartItem(itemId, quantity) {
        const { data } = await apiClient.patch(`/cart/items/${itemId}`, { quantity });

        return data.data;
    },

    async removeCartItem(itemId) {
        const { data } = await apiClient.delete(`/cart/items/${itemId}`);

        return data.data;
    },

    async clearCart() {
        const { data } = await apiClient.delete("/cart");

        return data.data;
    },

};
