import { matchedData } from "express-validator";

import { getCheckout } from "../services/checkoutService.js";
import { isOnlinePaymentEnabled } from "../services/paymentService.js";

// Read-only: prices, totals and stock are computed from the database; the
// only client input is which of the user's own addresses to use.
export async function getMyCheckout(req, res) {
    const { addressId } = matchedData(req, { locations: ["query"] });

    const data = await getCheckout(req.user.id, { addressId });

    // Online payment is offered only when the server has Razorpay keys.
    const paymentMethods = isOnlinePaymentEnabled() ? ["COD", "RAZORPAY"] : ["COD"];

    res.json({ success: true, data: { ...data, paymentMethods } });
}
