import { apiClient } from "./apiClient";

// Read-only checkout snapshot: items, prices, totals and validation all come
// from the server. The only inputs are which saved address to use and an
// applied coupon code (the server decides whether it applies and its discount).
export const checkoutService = {

    async getCheckout(addressId, couponCode) {
        const params = {
            ...(addressId && { addressId }),
            ...(couponCode && { couponCode }),
        };

        const { data } = await apiClient.get("/checkout", {
            params: Object.keys(params).length ? params : undefined,
        });

        return data.data;
    },

    // Whether a code applies to the signed-in user's cart now -> { coupon, summary }.
    // 422 with the reason when it does not. Takes no use of the coupon.
    async validateCoupon(couponCode) {
        const { data } = await apiClient.post("/coupons/validate", { couponCode });

        return data.data;
    },

};
