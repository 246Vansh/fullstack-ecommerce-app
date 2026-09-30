import { Router } from "express";
import { query } from "express-validator";

import { getMyCheckout } from "../controllers/checkoutController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const checkoutRules = [
    query("addressId").optional().isInt({ min: 1 }).withMessage("addressId must be a positive integer").toInt(),
];

router.use(authenticate);

router.get("/", checkoutRules, validate, getMyCheckout);

export default router;
