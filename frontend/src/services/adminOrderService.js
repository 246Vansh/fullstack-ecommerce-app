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

    // Sends a refund email whose retries are exhausted again; 409 when it is
    // no longer exhausted (sent, or already being retried). -> the order.
    async resendRefundEmail(id, refundId) {
        const { data } = await apiClient.post(`/admin/orders/${id}/refunds/${encodeURIComponent(refundId)}/resend-email`);

        return data.data;
    },

    // Acknowledges the refund state the admin was shown ({ refundCount,
    // refundedAmount } from paymentRefunds), which unblocks fulfilment; 409
    // when a refund arrived since (reload and review again). -> the order.
    async acknowledgeRefund(id, { refundCount, refundedAmount }) {
        const { data } = await apiClient.post(`/admin/orders/${id}/refund-review`, { refundCount, refundedAmount });

        return data.data;
    },

};
