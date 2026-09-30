import { apiClient } from "./apiClient";

// Read-only checkout snapshot: items, prices, totals and validation all come
// from the server. The only input is which saved address to use.
export const checkoutService = {

    async getCheckout(addressId) {
        const { data } = await apiClient.get("/checkout", {
            params: addressId ? { addressId } : undefined,
        });

        return data.data;
    },

};
