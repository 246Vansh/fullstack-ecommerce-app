import { Router } from "express";
import { body } from "express-validator";

import { createMyOrder } from "../controllers/orderController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const createRules = [
    body("addressId").isInt({ min: 1 }).withMessage("addressId must be a positive integer").toInt(),
];

router.use(authenticate);

router.post("/", createRules, validate, createMyOrder);

export default router;
