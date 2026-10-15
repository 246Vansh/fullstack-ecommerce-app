import { Router } from "express";
import { body, param } from "express-validator";

import { getReviews, getMyReview, createMyReview, updateMyReview, deleteMyReview } from "../controllers/reviewController.js";
import { REVIEW_BODY, REVIEW_PAGINATION } from "../services/reviewService.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { paginationRules, validate } from "../middleware/validate.js";
import { reviewMutationLimiter } from "../middleware/rateLimits.js";
import { ApiError } from "../utils/ApiError.js";

// Mounted at /products/:id/reviews; mergeParams exposes the product :id.
const router = Router({ mergeParams: true });

const MAX_ID = 2147483647; // INT column

const productIdRules = [
    param("id").isInt({ min: 1, max: MAX_ID }).withMessage("Product id must be a positive integer").toInt(),
];

// A JSON number only: "5", 4.5 and true are rejected rather than coerced.
const ratingRule = () => body("rating")
    .custom((value) => Number.isInteger(value) && value >= 1 && value <= 5)
    .withMessage("Rating must be a whole number from 1 to 5");

// Length is counted in code points, as MySQL counts VARCHAR(2000); validator's
// isLength skips emoji variation selectors, which MySQL does count. Arrays are
// refused first: standard validators would check each element and pass them.
const bodyRule = () => body("body")
    .not().isArray().withMessage("Review text is required")
    .bail()
    .isString().withMessage("Review text is required")
    .bail()
    .trim()
    .custom((value) => {
        const length = Array.from(value).length;
        return length >= REVIEW_BODY.min && length <= REVIEW_BODY.max;
    })
    .withMessage(`Review text must be ${REVIEW_BODY.min} to ${REVIEW_BODY.max} characters`);

const createRules = [ratingRule(), bodyRule()];

const updateRules = [ratingRule().optional(), bodyRule().optional()];

function requireSomeField(req, res, next) {
    if (!["rating", "body"].some((field) => field in (req.body ?? {}))) {
        return next(new ApiError(422, "Provide a rating or review text to update"));
    }

    next();
}

// Signed-in customers only (admins get 403); writes re-check the role in the service.
const customer = [authenticate, authorize("CUSTOMER")];

router.get("/", productIdRules, paginationRules(REVIEW_PAGINATION), validate, getReviews);
router.get("/mine", customer, productIdRules, validate, getMyReview);
router.post("/", customer, reviewMutationLimiter, productIdRules, createRules, validate, createMyReview);
router.patch("/mine", customer, reviewMutationLimiter, productIdRules, requireSomeField, updateRules, validate, updateMyReview);
router.delete("/mine", customer, reviewMutationLimiter, productIdRules, validate, deleteMyReview);

export default router;
