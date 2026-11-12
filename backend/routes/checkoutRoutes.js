import { Router } from "express";
import { query } from "express-validator";

import { getMyCheckout } from "../controllers/checkoutController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { couponCodeQuery } from "../middleware/couponRules.js";
import { couponAttemptLimiter } from "../middleware/rateLimits.js";

const router = Router();

const checkoutRules = [
    query("addressId").optional().isInt({ min: 1 }).withMessage("addressId must be a positive integer").toInt(),
    // Optional: a coupon the customer applied, priced into the summary (read-only).
    couponCodeQuery(),
];

router.use(authenticate);

// A checkout load that tries a coupon code counts against the same per-user
// budget as POST /coupons/validate, so codes cannot be guessed through it.
const limitCouponAttempts = (req, res, next) => (req.query.couponCode ? couponAttemptLimiter(req, res, next) : next());

router.get("/", limitCouponAttempts, checkoutRules, validate, getMyCheckout);

export default router;
