import { apiClient } from "./apiClient";

// Admin orders API (/api/admin/orders). The server checks the ADMIN role on
// every request and decides which status change is allowed; the client only
// names the next step.
export const adminOrderService = {

    // { page, limit, status?, refundDue? } -> { orders, pagination }, newest first.
    async listOrders(params) {
        const { data } = await apiClient.get("/admin/orders", { params });

        return { orders: data.data, pagination: data.pagination };
    },

    // The stored order snapshot plus userId, shippedAt, deliveredAt, nextStatus.
    async getOrder(id) {
        const { data } = await apiClient.get(`/admin/orders/${id}`);

        return data.data;
    },

    // Moves the order one step forward (CONFIRMED, PROCESSING, SHIPPED or
    // DELIVERED); 409 when it is no longer at the step before.
    async advanceStatus(id, status) {
        const { data } = await apiClient.patch(`/admin/orders/${id}/status`, { status });

        return data.data;
    },

};
