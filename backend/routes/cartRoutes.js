import { Router } from "express";
import { body, param } from "express-validator";

import {
    getMyCart,
    addCartItem,
    updateCartItem,
    removeCartItem,
    clearMyCart,
} from "../controllers/cartController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// Upper bound only guards against absurd values; the real limit is variant stock.
const MAX_QUANTITY = 999;

// Only variantId and quantity are read; any client price/total/stock is ignored.
const quantityRule = body("quantity")
    .isInt({ min: 1, max: MAX_QUANTITY })
    .withMessage(`Quantity must be a whole number between 1 and ${MAX_QUANTITY}`)
    .toInt();

const addRules = [
    body("variantId").isInt({ min: 1 }).withMessage("variantId must be a positive integer").toInt(),
    quantityRule,
];

const itemIdRules = [
    param("id").isInt({ min: 1 }).withMessage("Cart item id must be a positive integer").toInt(),
];

router.use(authenticate);

router.get("/", getMyCart);
router.delete("/", clearMyCart);
router.post("/items", addRules, validate, addCartItem);
router.patch("/items/:id", itemIdRules, quantityRule, validate, updateCartItem);
router.delete("/items/:id", itemIdRules, validate, removeCartItem);

export default router;
