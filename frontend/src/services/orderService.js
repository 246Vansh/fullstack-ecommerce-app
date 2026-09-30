import { apiClient } from "./apiClient";

// Orders are priced and built entirely by the server; placing one sends only
// which saved address to ship to.
export const orderService = {

    async createOrder(addressId) {
        const { data } = await apiClient.post("/orders", { addressId });

        return data.data;
    },

    // The persisted order snapshot (the signed-in user's own orders only).
    async getOrder(id) {
        const { data } = await apiClient.get(`/orders/${id}`);

        return data.data;
    },

};
