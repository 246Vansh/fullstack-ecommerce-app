import { Router } from "express";

import { validateMyCoupon } from "../controllers/couponController.js";
import { authenticate } from "../middleware/auth.js";
import { couponCodeBody } from "../middleware/couponRules.js";
import { couponAttemptLimiter } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.use(authenticate);

// Checks a code against the customer's own cart. Read-only: no use is taken.
router.post("/validate", couponAttemptLimiter, couponCodeBody({ required: true }), validate, validateMyCoupon);

export default router;
