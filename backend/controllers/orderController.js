import { matchedData } from "express-validator";

import { createOrder, getOrder } from "../services/orderService.js";

// Only addressId is read from the body; prices, totals, stock and product
// data all come from the database. The user always comes from the token.
export async function createMyOrder(req, res) {
    const { addressId } = matchedData(req, { locations: ["body"] });

    const data = await createOrder(req.user.id, { addressId });

    res.status(201).json({ success: true, data });
}

export async function getMyOrder(req, res) {
    const { id } = matchedData(req, { locations: ["params"] });

    const data = await getOrder(req.user.id, id);

    res.json({ success: true, data });
}
