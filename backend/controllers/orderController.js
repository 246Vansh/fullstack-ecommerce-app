import { matchedData } from "express-validator";

import { createOrder, getOrder, listOrders } from "../services/orderService.js";
import { cancelOrderAfterPaymentCheck, isOnlinePaymentEnabled } from "../services/paymentService.js";
import { ApiError } from "../utils/ApiError.js";

// Only addressId, the payment method (default COD) and optionally the total
// the customer saw (as a check) are read from the body; prices, totals, stock
// and product data all come from the database, and expectedTotal is never
// stored. The user comes from the token.
export async function createMyOrder(req, res) {
    const { addressId, expectedTotal, paymentMethod = "COD" } = matchedData(req, { locations: ["body"] });

    // Refused before anything is reserved, so no unpayable online order is created.
    if (paymentMethod === "RAZORPAY" && !isOnlinePaymentEnabled()) {
        throw new ApiError(503, "Online payment is not available right now");
    }

    const data = await createOrder(req.user.id, { addressId, expectedTotal, paymentMethod });

    res.status(201).json({ success: true, data });
}

export async function getMyOrder(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    const data = await getOrder(req.user.id, id);

    res.json({ success: true, data });
}

// The owner always comes from the token; the query only picks the page.
export async function getMyOrders(req, res) {
    const { page, limit } = matchedData(req, { locations: ["query"] });

    const { data, pagination } = await listOrders(req.user.id, { page, limit });

    res.json({ success: true, data, pagination });
}

// Status and stock are changed by the server only; the body is ignored.
export async function cancelMyOrder(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    // Online orders are checked with Razorpay first (a payment may be in flight); COD as before.
    const data = await cancelOrderAfterPaymentCheck(req.user.id, id);

    res.json({ success: true, data });
}
