import { Router } from "express";

import { razorpayWebhook } from "../controllers/webhookController.js";
import { webhookLimiter } from "../middleware/rateLimits.js";

const router = Router();

// Server-to-server: no cookies, no CORS, no access token. Authenticated only
// by the signature, checked in services/razorpayWebhookService.js.
router.post("/razorpay", webhookLimiter, razorpayWebhook);

export default router;
