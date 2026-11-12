import { matchedData } from "express-validator";

import { validateCouponForCart } from "../services/checkoutService.js";

// Only the code is read; the cart, prices and discount come from the database.
export async function validateMyCoupon(req, res) {
    const { couponCode } = matchedData(req, { locations: ["body"] });

    res.json({ success: true, data: await validateCouponForCart(req.user.id, couponCode) });
}
