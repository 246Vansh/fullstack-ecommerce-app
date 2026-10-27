import { apiClient } from "./apiClient";

// Orders are priced and built entirely by the server; placing one sends only
// which saved address to ship to, the payment method (COD or RAZORPAY), plus
// the total and currency the customer was shown so the server can refuse the
// order (409) if prices changed in the meantime.
export const orderService = {

    async createOrder(addressId, expectedTotal, paymentMethod = "COD", expectedCurrency) {
        const { data } = await apiClient.post("/orders", {
            addressId, expectedTotal, paymentMethod, ...(expectedCurrency && { expectedCurrency }),
        });

        return data.data;
    },

    // Razorpay Checkout options for an unpaid online order: the public key id,
    // the gateway order and the stored amount (never computed here).
    async startPayment(id) {
        const { data } = await apiClient.post(`/orders/${id}/payment`);

        return data.data;
    },

    // The ids Razorpay Checkout returned; the server checks the signature and the
    // payment with Razorpay. -> { state, order }
    async verifyPayment(id, { razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
        const { data } = await apiClient.post(`/orders/${id}/payment/verify`, { razorpayOrderId, razorpayPaymentId, razorpaySignature });

        return data.data;
    },

    // The server asks Razorpay for the order's payment status. -> { state, order }
    async refreshPayment(id) {
        const { data } = await apiClient.post(`/orders/${id}/payment/refresh`);

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

    // Read-only tracking view of the signed-in user's own order: the order
    // snapshot plus a timeline of its fulfilment steps, dated only where the
    // server recorded a date.
    async getOrderTracking(id) {
        const { data } = await apiClient.get(`/orders/${id}/tracking`);

        return data.data;
    },

    // The server checks ownership and status, and restores stock atomically.
    async cancelOrder(id) {
        const { data } = await apiClient.post(`/orders/${id}/cancel`);

        return data.data;
    },

};
