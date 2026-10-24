import { Router } from "express";
import { body } from "express-validator";

import {
    register,
    login,
    refresh,
    logout,
    logoutAll,
    forgotPassword,
    resetPassword,
    verifyEmail,
    me,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { requireTrustedOrigin } from "../middleware/origin.js";
import { validate, newPasswordRule, MAX_PASSWORD_INPUT_LENGTH } from "../middleware/validate.js";
import {
    credentialsLimiter, sessionLimiter, passwordResetRequestLimiter, emailTokenLimiter,
} from "../middleware/rateLimits.js";

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

// An emailed token: 32 random bytes, base64url (43 characters).
const emailTokenRule = body("token").isString().withMessage("This link is invalid or has expired. Please request a new one.")
    .bail().isLength({ min: 1, max: 128 }).withMessage("This link is invalid or has expired. Please request a new one.");

const forgotPasswordRules = [
    body("email").trim().isEmail().withMessage("Enter a valid email address")
        .isLength({ max: 191 }).withMessage("Email is too long")
        .normalizeEmail({ gmail_remove_dots: false }),
];

const resetPasswordRules = [emailTokenRule, newPasswordRule("password")];

// Every state-changing auth route sets or uses the refresh cookie.
router.use(requireTrustedOrigin);

router.post("/register", credentialsLimiter, registerRules, validate, register);
router.post("/login", credentialsLimiter, loginRules, validate, login);
router.post("/refresh", sessionLimiter, refresh);
router.post("/logout", sessionLimiter, logout);
router.post("/logout-all", sessionLimiter, logoutAll);
router.post("/forgot-password", passwordResetRequestLimiter, forgotPasswordRules, validate, forgotPassword);
router.post("/reset-password", emailTokenLimiter, resetPasswordRules, validate, resetPassword);
router.post("/verify-email", emailTokenLimiter, [emailTokenRule], validate, verifyEmail);
router.get("/me", authenticate, me);

export default router;
