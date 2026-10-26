import { Router } from "express";
import { body, param } from "express-validator";

import {
    getMyNotifications,
    getMyUnreadCount,
    readAllMyNotifications,
    readMyNotification,
} from "../controllers/notificationController.js";
import { NOTIFICATION_PAGINATION } from "../services/notificationService.js";
import { authenticate } from "../middleware/auth.js";
import { paginationRules, validate } from "../middleware/validate.js";
import { notificationMutationLimiter } from "../middleware/rateLimits.js";

const router = Router();

const MAX_ID = 2147483647; // INT column

const idRules = [
    param("id").isInt({ min: 1, max: MAX_ID }).withMessage("Notification id must be a positive integer").toInt(),
];

// Optional; a JSON integer only ("5" and 4.5 are rejected rather than coerced).
const readAllRules = [
    body("upToId").optional()
        .custom((value) => Number.isInteger(value) && value >= 1 && value <= MAX_ID)
        .withMessage("upToId must be a positive integer"),
];

// Every user (customers and admins) sees only their own notifications.
router.use(authenticate);

router.get("/", paginationRules(NOTIFICATION_PAGINATION), validate, getMyNotifications);
router.get("/unread-count", getMyUnreadCount);
router.patch("/read-all", notificationMutationLimiter, readAllRules, validate, readAllMyNotifications);
router.patch("/:id/read", notificationMutationLimiter, idRules, validate, readMyNotification);

export default router;
