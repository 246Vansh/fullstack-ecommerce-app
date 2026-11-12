import { apiClient } from "./apiClient";

// Admin coupons API (/api/admin/coupons). The server checks the ADMIN role on
// every request and owns usedCount (changed only by orders). Every write
// returns the admin coupon, so callers can replace their copy with it.
export const adminCouponService = {

    // { page, limit, search?, isActive? } -> { coupons, pagination }, newest first.
    async listCoupons(params) {
        const { data } = await apiClient.get("/admin/coupons", { params });

        return { coupons: data.data, pagination: data.pagination };
    },

    // The coupon plus its 20 most recent orders.
    async getCoupon(id) {
        const { data } = await apiClient.get(`/admin/coupons/${id}`);

        return data.data;
    },

    async createCoupon(payload) {
        const { data } = await apiClient.post("/admin/coupons", payload);

        return data.data;
    },

    // Only the fields being changed.
    async updateCoupon(id, changes) {
        const { data } = await apiClient.patch(`/admin/coupons/${id}`, changes);

        return data.data;
    },

    async setActive(id, active) {
        const { data } = await apiClient.post(`/admin/coupons/${id}/${active ? "activate" : "deactivate"}`);

        return data.data;
    },

    // 409 once any order has used it (it can then only be deactivated).
    async deleteCoupon(id) {
        const { data } = await apiClient.delete(`/admin/coupons/${id}`);

        return data.data;
    },

};
