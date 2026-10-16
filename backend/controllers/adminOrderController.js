import { matchedData } from "express-validator";

import { advanceOrderStatus, getAdminOrder, listAdminOrders } from "../services/orderService.js";

// Only validated fields reach the service (matchedData).
const params = (req) => matchedData(req, { locations: ["params"] });

export async function listOrders(req, res) {
    const { data, pagination } = await listAdminOrders(matchedData(req, { locations: ["query"] }));

    res.json({ success: true, data, pagination });
}

export async function getOrder(req, res) {
    res.json({ success: true, data: await getAdminOrder(params(req).id) });
}

export async function updateOrderStatus(req, res) {
    const { status } = matchedData(req, { locations: ["body"] });

    res.json({ success: true, data: await advanceOrderStatus(params(req).id, status) });
}
