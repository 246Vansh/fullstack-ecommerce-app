import { apiClient } from "./apiClient";

// Orders are priced and built entirely by the server; placing one sends only
// which saved address to ship to, plus the total the customer was shown so the
// server can refuse the order (409) if prices changed in the meantime.
export const orderService = {

    async createOrder(addressId, expectedTotal) {
        const { data } = await apiClient.post("/orders", { addressId, expectedTotal });

        return data.data;
    },

    // One page of the signed-in user's orders, newest first (list fields only),
    // with { page, limit, total, totalPages }.
    async listOrders({ page, limit }) {
        const { data } = await apiClient.get("/orders", { params: { page, limit } });

        return { orders: data.data, pagination: data.pagination };
    },

    // The persisted order snapshot (the signed-in user's own orders only).
    async getOrder(id) {
        const { data } = await apiClient.get(`/orders/${id}`);

        return data.data;
    },

    // The server checks ownership and status, and restores stock atomically.
    async cancelOrder(id) {
        const { data } = await apiClient.post(`/orders/${id}/cancel`);

        return data.data;
    },

};
