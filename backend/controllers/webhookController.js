import { handleWebhook } from "../services/razorpayWebhookService.js";

// req.body is the raw request body (a Buffer; see server.js): the signature
// covers those exact bytes, so it is never parsed before it is checked.
export async function razorpayWebhook(req, res) {
    const result = await handleWebhook(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), req.headers);

    res.json({ success: true, ...result });
}
