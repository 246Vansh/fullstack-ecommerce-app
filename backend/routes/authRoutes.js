import { Router } from "express";
import { body } from "express-validator";
import rateLimit from "express-rate-limit";

import {
    register,
    login,
    refresh,
    logout,
    me,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// Stricter limit on credential endpoints to slow brute-force attempts.
const credentialsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts, please try again later" },
});

const registerRules = [
    body("firstName").trim().notEmpty().withMessage("First name is required")
        .isLength({ max: 100 }).withMessage("First name is too long"),
    body("lastName").trim().notEmpty().withMessage("Last name is required")
        .isLength({ max: 100 }).withMessage("Last name is too long"),
    body("email").trim().isEmail().withMessage("Enter a valid email address")
        .isLength({ max: 191 }).withMessage("Email is too long")
        .normalizeEmail({ gmail_remove_dots: false }),
    body("password").isString()
        .isLength({ min: 8, max: 72 }).withMessage("Password must be 8 to 72 characters"),
];

const loginRules = [
    body("email").trim().isEmail().withMessage("Enter a valid email address")
        .normalizeEmail({ gmail_remove_dots: false }),
    body("password").isString().notEmpty().withMessage("Password is required"),
    body("remember").optional().isBoolean().toBoolean(),
];

router.post("/register", credentialsLimiter, registerRules, validate, register);
router.post("/login", credentialsLimiter, loginRules, validate, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;
