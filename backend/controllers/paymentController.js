import { matchedData } from "express-validator";

import { initiatePayment, refreshPayment, verifyPayment } from "../services/paymentService.js";

// The customer always comes from the token and the order from the URL; the
// amount is never read from the request.
const orderId = (req) => matchedData(req, { locations: ["params"] }).id;

export async function startMyPayment(req, res) {
    res.json({ success: true, data: await initiatePayment(req.user.id, orderId(req)) });
}

// Only the three ids Razorpay Checkout returned; the server re-checks them.
export async function verifyMyPayment(req, res) {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = matchedData(req, { locations: ["body"] });

    res.json({ success: true, data: await verifyPayment(req.user.id, orderId(req), { razorpayOrderId, razorpayPaymentId, razorpaySignature }) });
}

export async function refreshMyPayment(req, res) {
    res.json({ success: true, data: await refreshPayment(req.user.id, orderId(req)) });
}
