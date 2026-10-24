import { Router } from "express";
import { body, param } from "express-validator";

import {
    updateMyProfile, changeMyPassword, resendMyVerification, listMySessions, revokeMySession,
    revokeMyOtherSessions, deleteMyAccount,
} from "../controllers/accountController.js";
import { authenticate } from "../middleware/auth.js";
import { validate, newPasswordRule, MAX_PASSWORD_INPUT_LENGTH } from "../middleware/validate.js";
import {
    profileUpdateLimiter, passwordChangeLimiter, verificationResendLimiter, sessionManagementLimiter,
    accountDeletionLimiter,
} from "../middleware/rateLimits.js";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

// Lengths match the User columns in schema.prisma. All optional (PATCH).
const name = (field, label) => body(field).optional()
    .isString().withMessage(`${label} is required`)
    .trim()
    .notEmpty().withMessage(`${label} is required`)
    .isLength({ max: 100 }).withMessage(`${label} must be at most 100 characters`);

const profileRules = [
    name("firstName", "First name"),
    name("lastName", "Last name"),
    // An empty phone clears it (see accountService).
    body("phone").optional()
        .isString().withMessage("Phone must be text")
        .trim()
        .isLength({ max: 30 }).withMessage("Phone must be at most 30 characters")
        .custom((value) => value === "" || /^\+?[0-9\s().-]{7,30}$/.test(value)).withMessage("Enter a valid phone number"),
];

const PROFILE_FIELDS = ["firstName", "lastName", "phone"];

function requireSomeField(req, res, next) {
    if (!PROFILE_FIELDS.some((field) => field in (req.body ?? {}))) {
        return next(new ApiError(422, "Provide at least one profile field to update"));
    }

    next();
}

const passwordRules = [
    body("currentPassword").isString().withMessage("Current password is required")
        .notEmpty().withMessage("Current password is required")
        .isLength({ max: MAX_PASSWORD_INPUT_LENGTH }).withMessage("Current password is too long"),
    newPasswordRule("newPassword"),
];

// Session ids are refresh-token family ids (UUIDs, the access token's sid).
const sessionIdRule = param("sessionId").isUUID().withMessage("Session not found");

const deleteAccountRules = [
    body("password").isString().withMessage("Password is required")
        .notEmpty().withMessage("Password is required")
        .isLength({ max: MAX_PASSWORD_INPUT_LENGTH }).withMessage("Password is too long"),
];

router.use(authenticate);

router.patch("/profile", profileUpdateLimiter, requireSomeField, profileRules, validate, updateMyProfile);
router.post("/password", passwordChangeLimiter, passwordRules, validate, changeMyPassword);
router.post("/verification-email", verificationResendLimiter, resendMyVerification);
router.get("/sessions", sessionManagementLimiter, listMySessions);
router.delete("/sessions", sessionManagementLimiter, revokeMyOtherSessions);
router.delete("/sessions/:sessionId", sessionManagementLimiter, sessionIdRule, validate, revokeMySession);
router.delete("/", accountDeletionLimiter, deleteAccountRules, validate, deleteMyAccount);

export default router;
