import { matchedData } from "express-validator";

import { advanceOrderStatus, getAdminOrder, listAdminOrders } from "../services/orderService.js";
import { acknowledgeRefund, resendRefundEmail } from "../services/refundService.js";

// Only validated fields reach the service (matchedData).
const params = (req) => matchedData(req, { locations: ["params"] });

export async function listOrders(req, res) {
    const { data, pagination } = await listAdminOrders(matchedData(req, { locations: ["query"] }));

    res.json({ success: true, data, pagination });
}

export async function getOrder(req, res) {
    res.json({ success: true, data: await getAdminOrder(params(req).id) });
}

// The admin acknowledges the refund state they were shown (refundCount and
// refundedAmount from GET /admin/orders/:id); refused if it has changed since.
export async function acknowledgeOrderRefund(req, res) {
    const { id } = params(req);
    const { refundCount, refundedAmount } = matchedData(req, { locations: ["body"] });

    await acknowledgeRefund(id, req.user.id, { refundCount, refundedAmount });

    res.json({ success: true, data: await getAdminOrder(id) });
}

// Sends an exhausted refund email again (see refundService.resendRefundEmail).
export async function resendOrderRefundEmail(req, res) {
    const { id, refundId } = params(req);

    await resendRefundEmail(id, refundId, req.user.id);

    res.json({ success: true, data: await getAdminOrder(id) });
}

export async function updateOrderStatus(req, res) {
    const { status } = matchedData(req, { locations: ["body"] });

    res.json({ success: true, data: await advanceOrderStatus(params(req).id, status) });
}
