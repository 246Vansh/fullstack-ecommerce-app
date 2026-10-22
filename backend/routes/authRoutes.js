import { Router } from "express";
import { body } from "express-validator";

import {
    register,
    login,
    refresh,
    logout,
    me,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { validate, newPasswordRule, MAX_PASSWORD_INPUT_LENGTH } from "../middleware/validate.js";
import { credentialsLimiter, sessionLimiter } from "../middleware/rateLimits.js";

const router = Router();

const registerRules = [
    body("firstName").trim().notEmpty().withMessage("First name is required")
        .isLength({ max: 100 }).withMessage("First name is too long"),
    body("lastName").trim().notEmpty().withMessage("Last name is required")
        .isLength({ max: 100 }).withMessage("Last name is too long"),
    body("email").trim().isEmail().withMessage("Enter a valid email address")
        .isLength({ max: 191 }).withMessage("Email is too long")
        .normalizeEmail({ gmail_remove_dots: false }),
    newPasswordRule("password"),
];

const loginRules = [
    body("email").trim().isEmail().withMessage("Enter a valid email address")
        .normalizeEmail({ gmail_remove_dots: false }),
    body("password").isString().notEmpty().withMessage("Password is required")
        .isLength({ max: MAX_PASSWORD_INPUT_LENGTH }).withMessage("Password is too long"),
    body("remember").optional().isBoolean().toBoolean(),
];

router.post("/register", credentialsLimiter, registerRules, validate, register);
router.post("/login", credentialsLimiter, loginRules, validate, login);
router.post("/refresh", sessionLimiter, refresh);
router.post("/logout", sessionLimiter, logout);
router.get("/me", authenticate, me);

export default router;
