import { Router } from "express";
import { body, param } from "express-validator";

import { createMyOrder, getMyOrder } from "../controllers/orderController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { orderMutationLimiter } from "../middleware/rateLimits.js";

const router = Router();

const createRules = [
    body("addressId").isInt({ min: 1 }).withMessage("addressId must be a positive integer").toInt(),
];

const idRules = [
    param("id").isInt({ min: 1 }).withMessage("Order id must be a positive integer").toInt(),
];

router.use(authenticate);

router.post("/", orderMutationLimiter, createRules, validate, createMyOrder);
router.get("/:id", idRules, validate, getMyOrder);

export default router;
