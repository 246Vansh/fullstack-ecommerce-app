import { Router } from "express";
import { body, param, query } from "express-validator";

import { createMyOrder, getMyOrder, getMyOrders, cancelMyOrder } from "../controllers/orderController.js";
import { ORDER_PAGINATION } from "../services/orderService.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { orderMutationLimiter } from "../middleware/rateLimits.js";

const router = Router();

const createRules = [
    body("addressId").isInt({ min: 1 }).withMessage("addressId must be a positive integer").toInt(),
    // Optional: the checkout total the customer saw, compared (never stored).
    body("expectedTotal").optional()
        .isDecimal({ decimal_digits: "0,2" }).withMessage("expectedTotal must be an amount with at most 2 decimals")
        .bail()
        .custom((value) => Number(value) >= 0).withMessage("expectedTotal cannot be negative"),
];

// A repeated parameter (?page=1&page=2) arrives as an array; reject it rather
// than guess which value was meant.
const singleInt = (name, fallback, max) => query(name)
    .not().isArray().withMessage(`${name} must be given once`)
    .bail()
    .default(fallback)
    .isInt({ min: 1, max }).withMessage(`${name} must be between 1 and ${max}`)
    .toInt();

const listRules = [
    singleInt("page", 1, ORDER_PAGINATION.maxPage),
    singleInt("limit", ORDER_PAGINATION.defaultLimit, ORDER_PAGINATION.maxLimit),
];

const idRules = [
    param("id").isInt({ min: 1 }).withMessage("Order id must be a positive integer").toInt(),
];

router.use(authenticate);

// Creating and cancelling share one per-user budget, so place/cancel loops
// cannot churn inventory faster than normal ordering.
router.get("/", listRules, validate, getMyOrders);
router.post("/", orderMutationLimiter, createRules, validate, createMyOrder);
router.get("/:id", idRules, validate, getMyOrder);
router.post("/:id/cancel", orderMutationLimiter, idRules, validate, cancelMyOrder);

export default router;
