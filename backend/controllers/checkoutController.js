import { matchedData } from "express-validator";

import { getCheckout } from "../services/checkoutService.js";
import { isOnlinePaymentEnabled } from "../services/paymentService.js";

// Read-only: prices, totals and stock are computed from the database; the
// only client input is which of the user's own addresses to use and which
// coupon code to try (never a discount amount).
export async function getMyCheckout(req, res) {
    const { addressId, couponCode } = matchedData(req, { locations: ["query"] });

    const data = await getCheckout(req.user.id, { addressId, couponCode });

    // Online payment is offered only when the server has Razorpay keys.
    const paymentMethods = isOnlinePaymentEnabled() ? ["COD", "RAZORPAY"] : ["COD"];

    res.json({ success: true, data: { ...data, paymentMethods } });
}
