import { matchedData } from "express-validator";

import { createOrder, getOrder, listOrders, cancelOrder } from "../services/orderService.js";

// Only addressId (and optionally the total the customer saw, as a check) is
// read from the body; prices, totals, stock and product data all come from the
// database, and expectedTotal is never stored. The user comes from the token.
export async function createMyOrder(req, res) {
    const { addressId, expectedTotal } = matchedData(req, { locations: ["body"] });

    const data = await createOrder(req.user.id, { addressId, expectedTotal });

    res.status(201).json({ success: true, data });
}

export async function getMyOrder(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    const data = await getOrder(req.user.id, id);

    res.json({ success: true, data });
}

export async function getMyOrders(req, res) {
    const data = await listOrders(req.user.id);

    res.json({ success: true, data });
}

// Status and stock are changed by the server only; the body is ignored.
export async function cancelMyOrder(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    const data = await cancelOrder(req.user.id, id);

    res.json({ success: true, data });
}
